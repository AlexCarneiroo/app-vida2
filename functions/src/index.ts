import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { defineSecret, defineString } from 'firebase-functions/params'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import * as webpush from 'web-push'
import type { DataName } from '../../src/lib/reminderEngine'
import {
  dispatchForUser,
  isTrustedEndpoint,
  unwrapCloudDoc,
  type DispatchDeps,
  type PushSub,
  type SendResult,
  type UserPushDoc,
} from './dispatch'

initializeApp()
const db = getFirestore()

// Chave pública e contacto ficam em functions/.env; a privada é um segredo.
const VAPID_PUBLIC_KEY = defineString('VAPID_PUBLIC_KEY')
const VAPID_SUBJECT = defineString('VAPID_SUBJECT')
const VAPID_PRIVATE_KEY = defineSecret('VAPID_PRIVATE_KEY')

let vapidReady = false
function ensureVapid() {
  if (vapidReady) return
  webpush.setVapidDetails(
    VAPID_SUBJECT.value(),
    VAPID_PUBLIC_KEY.value(),
    VAPID_PRIVATE_KEY.value(),
  )
  vapidReady = true
}

async function sendPush(sub: PushSub, payload: string): Promise<SendResult> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
      { TTL: 15 * 60, urgency: 'high' },
    )
    return 'ok'
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) return 'gone'
    console.warn('[push] falha ao enviar', status ?? err)
    return 'error'
  }
}

function loaderFor(uid: string): DispatchDeps['loadStates'] {
  return async (names: DataName[]) => {
    const snaps = await Promise.all(
      names.map((name) => db.doc(`users/${uid}/app/${name}`).get()),
    )
    const out: Partial<Record<DataName, unknown>> = {}
    snaps.forEach((snap, i) => {
      if (snap.exists) out[names[i]] = unwrapCloudDoc(snap.data())
    })
    return out
  }
}

async function removeGone(uid: string, ids: string[]) {
  if (ids.length === 0) return
  // Os ids são hashes hexadecimais, por isso a notação com ponto é segura.
  const updates: Record<string, FieldValue> = {}
  for (const id of ids) updates[`subscriptions.${id}`] = FieldValue.delete()
  await db.doc(`pushUsers/${uid}`).update(updates)
}

/** A cada 5 minutos: avisa quem tem lembretes na hora, mesmo com o app fechado. */
export const sendReminders = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'America/Sao_Paulo',
    secrets: [VAPID_PRIVATE_KEY],
    timeoutSeconds: 120,
    maxInstances: 1,
  },
  async () => {
    ensureVapid()
    const instant = new Date()
    const users = await db
      .collection('pushUsers')
      .where('enabled', '==', true)
      .get()

    let delivered = 0
    for (const snap of users.docs) {
      const uid = snap.id
      try {
        const outcome = await dispatchForUser(
          instant,
          snap.data() as UserPushDoc,
          { loadStates: loaderFor(uid), send: sendPush },
        )
        if (outcome.sent) await snap.ref.update({ sent: outcome.sent })
        await removeGone(uid, outcome.goneSubs)
        delivered += outcome.delivered.length
      } catch (err) {
        console.error(`[push] erro com ${uid}`, err)
      }
    }
    console.log(`[push] ${users.size} utilizadores, ${delivered} avisos enviados`)
  },
)

/** Botão "Testar push do servidor" na app: envia uma notificação já. */
export const sendTestPush = onCall(
  { secrets: [VAPID_PRIVATE_KEY], maxInstances: 5 },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Sessão necessária.')
    ensureVapid()

    const ref = db.doc(`pushUsers/${uid}`)
    const snap = await ref.get()
    const data = (snap.data() ?? {}) as UserPushDoc & { lastTestAt?: number }

    const now = Date.now()
    if (data.lastTestAt && now - data.lastTestAt < 10_000) {
      throw new HttpsError('resource-exhausted', 'Aguarde alguns segundos.')
    }

    const entries = Object.entries(data.subscriptions ?? {}).filter(
      (entry): entry is [string, PushSub] =>
        isTrustedEndpoint(entry[1]?.endpoint) &&
        typeof entry[1]?.p256dh === 'string' &&
        typeof entry[1]?.auth === 'string',
    )
    if (entries.length === 0) {
      throw new HttpsError(
        'failed-precondition',
        'Nenhum aparelho com push ativo.',
      )
    }

    const payload = JSON.stringify({
      title: 'VIDA · push do servidor ✅',
      body: 'Funciona mesmo com o app fechado!',
      url: '/config',
      tag: 'teste-servidor',
    })
    const results = await Promise.all(
      entries.slice(0, 5).map(async ([id, sub]) => ({
        id,
        result: await sendPush(sub, payload),
      })),
    )
    await removeGone(
      uid,
      results.filter((r) => r.result === 'gone').map((r) => r.id),
    )
    await ref.set({ lastTestAt: now }, { merge: true })

    return {
      sent: results.filter((r) => r.result === 'ok').length,
      failed: results.filter((r) => r.result !== 'ok').length,
    }
  },
)
