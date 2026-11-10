/**
 * Tipos e regras puras das notificações (sem React nem window), para o app
 * e o servidor (Cloud Functions) usarem exatamente a mesma lógica.
 */

/** Configurações de notificações. */
export type NotifSettings = {
  /** Interruptor geral */
  enabled: boolean
  treino: { on: boolean; time: string }
  agua: { on: boolean; everyMin: number; from: string; to: string }
  habitos: { on: boolean; streakGuard: boolean }
  rotina: { on: boolean }
  contas: { on: boolean; time: string }
  sono: { on: boolean; time: string }
  resumo: { on: boolean; time: string }
}

export type ReminderKind = keyof Omit<NotifSettings, 'enabled'>

export type Notice = {
  title: string
  body: string
  /** Rota para abrir ao tocar (ex.: /treino) */
  url?: string
  /** Mesma tag substitui a notificação anterior */
  tag?: string
}

export const DEFAULT_NOTIF_SETTINGS: NotifSettings = {
  enabled: false,
  treino: { on: true, time: '18:00' },
  agua: { on: true, everyMin: 120, from: '08:00', to: '21:00' },
  habitos: { on: true, streakGuard: true },
  rotina: { on: false },
  contas: { on: true, time: '09:00' },
  sono: { on: false, time: '22:30' },
  resumo: { on: false, time: '21:00' },
}

/** Quanto tempo depois da hora marcada ainda vale avisar. */
export const GRACE_MIN = 15

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function cleanTime(value: unknown, fallback: string) {
  return typeof value === 'string' && TIME_RE.test(value) ? value : fallback
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

/** Aceita qualquer coisa (localStorage, Firestore) e devolve configurações válidas. */
export function normalizeNotifSettings(raw: unknown): NotifSettings {
  const d = DEFAULT_NOTIF_SETTINGS
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >
  const sub = (key: string) =>
    (r[key] && typeof r[key] === 'object' ? r[key] : {}) as Record<
      string,
      unknown
    >
  const water = sub('agua')
  const every = Number(water.everyMin)
  return {
    enabled: bool(r.enabled, d.enabled),
    treino: {
      on: bool(sub('treino').on, d.treino.on),
      time: cleanTime(sub('treino').time, d.treino.time),
    },
    agua: {
      on: bool(water.on, d.agua.on),
      everyMin: [60, 90, 120, 180].includes(every) ? every : d.agua.everyMin,
      from: cleanTime(water.from, d.agua.from),
      to: cleanTime(water.to, d.agua.to),
    },
    habitos: {
      on: bool(sub('habitos').on, d.habitos.on),
      streakGuard: bool(sub('habitos').streakGuard, d.habitos.streakGuard),
    },
    rotina: { on: bool(sub('rotina').on, d.rotina.on) },
    contas: {
      on: bool(sub('contas').on, d.contas.on),
      time: cleanTime(sub('contas').time, d.contas.time),
    },
    sono: {
      on: bool(sub('sono').on, d.sono.on),
      time: cleanTime(sub('sono').time, d.sono.time),
    },
    resumo: {
      on: bool(sub('resumo').on, d.resumo.on),
      time: cleanTime(sub('resumo').time, d.resumo.time),
    },
  }
}
