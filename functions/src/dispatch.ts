import {
  collectDueReminders,
  type DataName,
  type ReadState,
  type ReminderStates,
} from '../../src/lib/reminderEngine'
import {
  normalizeNotifSettings,
  type NotifSettings,
} from '../../src/lib/notifSettings'

/**
 * Lógica de envio por utilizador — sem Firebase nem rede, para poder ser
 * testada. O `index.ts` liga isto ao Firestore e ao web-push.
 */

export type PushSub = { endpoint: string; p256dh: string; auth: string }

export type UserPushDoc = {
  enabled?: boolean
  tz?: string
  settings?: unknown
  subscriptions?: Record<string, Partial<PushSub> | undefined>
  /** id do aviso → instante (ms) em que foi enviado */
  sent?: Record<string, number>
}

export type SendResult = 'ok' | 'gone' | 'error'

export type DispatchDeps = {
  /** Carrega os módulos pedidos (dados do utilizador na nuvem). */
  loadStates: (names: DataName[]) => Promise<Partial<Record<DataName, unknown>>>
  send: (sub: PushSub, payload: string) => Promise<SendResult>
}

export type DispatchOutcome = {
  /** Avisos enviados com sucesso nesta rodada */
  delivered: string[]
  /** Assinaturas que o serviço de push disse que já não existem */
  goneSubs: string[]
  /** Novo mapa `sent` para gravar, ou null se nada mudou */
  sent: Record<string, number> | null
}

const DEFAULT_TZ = 'America/Sao_Paulo'
const MAX_SUBS = 5
const SENT_TTL_MS = 3 * 24 * 60 * 60 * 1000

/** Serviços de push conhecidos — evita enviar para URLs arbitrárias. */
const PUSH_HOSTS = [
  /(^|\.)fcm\.googleapis\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)notify\.windows\.com$/,
]

export function isTrustedEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string') return false
  try {
    const url = new URL(endpoint)
    return (
      url.protocol === 'https:' &&
      PUSH_HOSTS.some((re) => re.test(url.hostname))
    )
  } catch {
    return false
  }
}

/** Hora de parede do utilizador, como um Date cujos campos locais a refletem. */
export function wallClock(instant: Date, tz: string): Date {
  const read = (zone: string) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(instant)
    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value)
    return new Date(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      0,
      0,
    )
  }
  try {
    return read(tz)
  } catch {
    return read(DEFAULT_TZ)
  }
}

/** Que módulos de dados os lembretes ligados precisam de ler. */
export function neededData(s: NotifSettings): DataName[] {
  const names = new Set<DataName>()
  if (s.treino.on || s.resumo.on) names.add('treino')
  if (s.agua.on || s.resumo.on) names.add('nutricao')
  if (s.habitos.on || s.resumo.on) names.add('habitos')
  if (s.contas.on) names.add('financas')
  if (s.rotina.on) names.add('rotina')
  return [...names]
}

/** Os docs na nuvem vêm embrulhados: { schemaVersion, data, ... }. */
export function unwrapCloudDoc(raw: unknown): unknown {
  let node = raw
  for (let i = 0; i < 3; i++) {
    if (
      node &&
      typeof node === 'object' &&
      'schemaVersion' in node &&
      'data' in node
    ) {
      node = (node as { data: unknown }).data
    }
  }
  return node && typeof node === 'object' ? node : null
}

export async function dispatchForUser(
  instant: Date,
  doc: UserPushDoc,
  deps: DispatchDeps,
): Promise<DispatchOutcome> {
  const none: DispatchOutcome = { delivered: [], goneSubs: [], sent: null }
  if (!doc.enabled) return none

  const settings = normalizeNotifSettings(doc.settings)
  if (!settings.enabled) return none

  const subs = Object.entries(doc.subscriptions ?? {})
    .filter(
      (entry): entry is [string, PushSub] =>
        isTrustedEndpoint(entry[1]?.endpoint) &&
        typeof entry[1]?.p256dh === 'string' &&
        typeof entry[1]?.auth === 'string',
    )
    .slice(0, MAX_SUBS)
  if (subs.length === 0) return none

  const now = wallClock(instant, doc.tz || DEFAULT_TZ)
  const states = await deps.loadStates(neededData(settings))
  const read: ReadState = (name) =>
    (states[name] as Partial<ReminderStates[typeof name]> | undefined) ?? null

  const sentBefore = doc.sent ?? {}
  const due = collectDueReminders({ now, settings, read }).filter(
    (reminder) => !sentBefore[reminder.id],
  )
  if (due.length === 0) return none

  const delivered: string[] = []
  const gone = new Set<string>()
  const sent = { ...sentBefore }

  for (const reminder of due) {
    const payload = JSON.stringify({
      title: reminder.title,
      body: reminder.body,
      url: reminder.url ?? '/',
      tag: reminder.tag,
    })
    const results = await Promise.all(
      subs.map(async ([id, sub]) => ({ id, result: await deps.send(sub, payload) })),
    )
    for (const { id, result } of results) {
      if (result === 'gone') gone.add(id)
    }
    // Só marca como enviado se pelo menos um aparelho recebeu;
    // senão tenta de novo no próximo ciclo (dentro da janela de tolerância).
    if (results.some((r) => r.result === 'ok')) {
      sent[reminder.id] = instant.getTime()
      delivered.push(reminder.id)
    }
  }

  if (delivered.length === 0) {
    return { delivered, goneSubs: [...gone], sent: null }
  }
  for (const key of Object.keys(sent)) {
    if (instant.getTime() - sent[key] > SENT_TTL_MS) delete sent[key]
  }
  return { delivered, goneSubs: [...gone], sent }
}
