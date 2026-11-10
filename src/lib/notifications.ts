import { useSyncExternalStore } from 'react'
import {
  DEFAULT_NOTIF_SETTINGS,
  normalizeNotifSettings,
  type Notice,
  type NotifSettings,
} from './notifSettings'

export {
  DEFAULT_NOTIF_SETTINGS,
  GRACE_MIN,
  type Notice,
  type NotifSettings,
  type ReminderKind,
} from './notifSettings'

const SETTINGS_KEY = 'vida.notif.v1'
const FIRED_KEY = 'vida.notif.fired.v1'
/** true = este aparelho recebe os avisos por push do servidor. */
const PUSH_ACTIVE_KEY = 'vida.notif.push.v1'

function readSettings(): NotifSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return normalizeNotifSettings(raw ? JSON.parse(raw) : null)
  } catch {
    return normalizeNotifSettings(null)
  }
}

let current: NotifSettings = readSettings()
const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

if (typeof window !== 'undefined') {
  // Outra aba/janela do app alterou as configurações.
  window.addEventListener('storage', (e) => {
    if (e.key === SETTINGS_KEY) current = readSettings()
    if (e.key === SETTINGS_KEY || e.key === PUSH_ACTIVE_KEY) emit()
  })
}

export function getNotifSettings() {
  return current
}

export function updateNotifSettings(
  patch: (prev: NotifSettings) => NotifSettings,
) {
  current = normalizeNotifSettings(patch(current))
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(current))
  } catch {
    // quota — mantém em memória
  }
  emit()
}

export function useNotifSettings() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => current,
    () => DEFAULT_NOTIF_SETTINGS,
  )
}

/* —— Push do servidor ativo neste aparelho? —— */

export function isPushActive() {
  try {
    return localStorage.getItem(PUSH_ACTIVE_KEY) === '1'
  } catch {
    return false
  }
}

export function setPushActive(active: boolean) {
  try {
    if (active) localStorage.setItem(PUSH_ACTIVE_KEY, '1')
    else localStorage.removeItem(PUSH_ACTIVE_KEY)
  } catch {
    // ignora
  }
  emit()
}

/** Reativo: muda quando o push é ligado/desligado. */
export function usePushActive() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    isPushActive,
    () => false,
  )
}

/* —— Suporte e permissão —— */

export type NotifPermission = 'granted' | 'denied' | 'default' | 'unsupported'

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function currentPermission(): NotifPermission {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotifPermission(): Promise<NotifPermission> {
  if (!notificationsSupported()) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return currentPermission()
  }
}

/** iPhone/iPad só entregam notificações com o app instalado no ecrã principal. */
export function needsIosInstall() {
  if (typeof navigator === 'undefined') return false
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return ios && !standalone
}

/* —— Envio local —— */

/**
 * Mostra pelo service worker (obrigatório no Android e o único modo que
 * permite tocar para abrir o app). Em desenvolvimento, sem SW, cai no
 * construtor clássico.
 */
export async function showNotice(notice: Notice): Promise<boolean> {
  if (currentPermission() !== 'granted') return false
  const options: NotificationOptions = {
    body: notice.body,
    tag: notice.tag,
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    lang: 'pt-BR',
    data: { url: notice.url ?? '/' },
  }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) {
      await reg.showNotification(notice.title, options)
      return true
    }
    new Notification(notice.title, options)
    return true
  } catch {
    return false
  }
}

/* —— Anti-repetição (modo local) —— */

function readFired(): Record<string, number> {
  try {
    const raw = localStorage.getItem(FIRED_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

/** Marca como enviado. Devolve false se já tinha sido enviado. */
export function markFired(id: string): boolean {
  const fired = readFired()
  if (fired[id]) return false
  const now = Date.now()
  fired[id] = now
  const cutoff = now - 3 * 24 * 60 * 60 * 1000
  for (const key of Object.keys(fired)) {
    if (fired[key] < cutoff) delete fired[key]
  }
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(fired))
  } catch {
    // quota
  }
  return true
}
