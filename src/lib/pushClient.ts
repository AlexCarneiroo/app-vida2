import {
  deleteField,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { ensureCloudUser } from './cloudSync'
import { db, firebaseApp, firebaseReady } from './firebase'
import {
  currentPermission,
  getNotifSettings,
  isPushActive,
  setPushActive,
} from './notifications'
import type { NotifSettings } from './notifSettings'

/**
 * Push de verdade (Web Push + VAPID): o servidor (Cloud Functions) envia os
 * lembretes na hora certa e o service worker mostra mesmo com o app fechado.
 * Coleção `pushUsers/{uid}` guarda as assinaturas e as configurações.
 */

const VAPID_PUBLIC_KEY = String(
  import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '',
).trim()

export function pushConfigured() {
  return (
    firebaseReady &&
    Boolean(VAPID_PUBLIC_KEY) &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function shortHash(text: string) {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .slice(0, 10)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function userTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
  } catch {
    return 'America/Sao_Paulo'
  }
}

async function pushDocRef() {
  if (!db) return null
  const user = await ensureCloudUser()
  if (!user) return null
  return doc(db, 'pushUsers', user.uid)
}

/** Assina (ou reaproveita a assinatura) o push deste aparelho. */
async function subscribeDevice(): Promise<PushSubscription> {
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) throw new Error('sem-service-worker')

  const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  const existing = await reg.pushManager.getSubscription()
  if (existing) {
    const sameKey =
      existing.options.applicationServerKey &&
      new Uint8Array(existing.options.applicationServerKey).every(
        (b, i) => b === key[i],
      )
    if (sameKey) return existing
    await existing.unsubscribe()
  }
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  })
}

async function saveToServer(sub: PushSubscription, settings: NotifSettings) {
  const ref = await pushDocRef()
  if (!ref) throw new Error('sem-nuvem')
  const json = sub.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!json.endpoint || !p256dh || !auth) throw new Error('assinatura-invalida')
  const id = await shortHash(json.endpoint)

  await setDoc(
    ref,
    {
      enabled: settings.enabled,
      tz: userTimeZone(),
      settings,
      updatedAt: Date.now(),
      subscriptions: {
        [id]: {
          endpoint: json.endpoint,
          p256dh,
          auth,
          ua: navigator.userAgent.slice(0, 120),
          updatedAt: Date.now(),
        },
      },
    },
    { merge: true },
  )
}

let inFlight: Promise<boolean> | null = null

/**
 * Garante que este aparelho está assinado e o servidor tem as configurações
 * atuais. Devolve true se o push do servidor ficou ativo.
 */
export function ensurePush(): Promise<boolean> {
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const settings = getNotifSettings()
      if (
        !pushConfigured() ||
        !settings.enabled ||
        currentPermission() !== 'granted'
      ) {
        setPushActive(false)
        return false
      }
      const sub = await subscribeDevice()
      await saveToServer(sub, settings)
      setPushActive(true)
      return true
    } catch (err) {
      console.warn('[push] indisponível, a usar lembretes locais', err)
      setPushActive(false)
      return false
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

/** Atualiza só as configurações no servidor (aparelho já assinado). */
export async function syncPushSettings() {
  if (!isPushActive()) return
  try {
    const ref = await pushDocRef()
    if (!ref) return
    const settings = getNotifSettings()
    await setDoc(
      ref,
      {
        enabled: settings.enabled,
        tz: userTimeZone(),
        settings,
        updatedAt: Date.now(),
      },
      { merge: true },
    )
  } catch (err) {
    console.warn('[push] não foi possível sincronizar configurações', err)
  }
}

/** Remove a assinatura deste aparelho (servidor e navegador). */
export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    const ref = await pushDocRef()
    if (sub && ref) {
      const id = await shortHash(sub.endpoint)
      try {
        await updateDoc(ref, { [`subscriptions.${id}`]: deleteField() })
      } catch {
        // documento ainda não existe
      }
      const snap = await getDoc(ref)
      const left = Object.keys(
        (snap.data()?.subscriptions as Record<string, unknown> | undefined) ??
          {},
      )
      if (left.length === 0) await setDoc(ref, { enabled: false }, { merge: true })
    }
    await sub?.unsubscribe()
  } catch (err) {
    console.warn('[push] falha ao remover assinatura', err)
  } finally {
    setPushActive(false)
  }
}

export type ServerTestResult = { sent: number; failed: number }

/** Pede ao servidor para enviar uma notificação de teste a este utilizador. */
export async function sendServerTest(): Promise<ServerTestResult> {
  if (!firebaseApp) throw new Error('sem-nuvem')
  await ensureCloudUser()
  const { getFunctions, httpsCallable } = await import('firebase/functions')
  const call = httpsCallable<unknown, ServerTestResult>(
    getFunctions(firebaseApp),
    'sendTestPush',
  )
  const res = await call({})
  return res.data
}
