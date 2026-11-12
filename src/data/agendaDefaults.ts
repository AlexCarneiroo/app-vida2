import { dateKey, uid } from '../lib/date'
import type {
  AgendaCategory,
  AgendaEvent,
  AgendaPriority,
  AgendaRecurrence,
  AgendaState,
  AgendaStatus,
  AvailabilityException,
  WeeklyAvailability,
  WorkShiftKind,
} from '../types/agenda'

export const DEFAULT_AGENDA_CATEGORIES: AgendaCategory[] = [
  { id: 'trabalho', label: 'Trabalho', color: '#5b8def', builtIn: true },
  { id: 'pessoal', label: 'Pessoal', color: '#c4a484', builtIn: true },
  { id: 'estudos', label: 'Estudos', color: '#8b7cf6', builtIn: true },
  { id: 'saude', label: 'Saúde', color: '#5ec4b6', builtIn: true },
  { id: 'treino', label: 'Treino', color: '#3d9b7a', builtIn: true },
  { id: 'familia', label: 'Família', color: '#e08a6b', builtIn: true },
  { id: 'financeiro', label: 'Financeiro', color: '#d4a017', builtIn: true },
  { id: 'lazer', label: 'Lazer', color: '#6bb8a0', builtIn: true },
  { id: 'reunioes', label: 'Reuniões', color: '#4f7cac', builtIn: true },
  { id: 'descanso', label: 'Descanso', color: '#9aa4b2', builtIn: true },
  { id: 'outros', label: 'Outros', color: '#7a8494', builtIn: true },
]

export const AGENDA_CATEGORY_EMOJI: Record<string, string> = {
  trabalho: '💼',
  pessoal: '🌿',
  estudos: '📚',
  saude: '💚',
  treino: '🏋️',
  familia: '🏠',
  financeiro: '💰',
  lazer: '✨',
  reunioes: '🗓️',
  descanso: '😴',
  outros: '📌',
  habito: '⭐',
  rotina: '🔁',
}

export function agendaCategoryEmoji(categoryId: string, source?: string) {
  if (source === 'treino') return AGENDA_CATEGORY_EMOJI.treino
  if (source === 'habito') return AGENDA_CATEGORY_EMOJI.habito
  if (source === 'rotina') return AGENDA_CATEGORY_EMOJI.rotina
  return AGENDA_CATEGORY_EMOJI[categoryId] ?? '📌'
}

export const WORK_SHIFT_LABELS: Record<WorkShiftKind, string> = {
  normal: 'Expediente normal',
  estendido: 'Expediente estendido',
  plantao: 'Plantão',
  '12x36': 'Escala 12x36',
  '6x1': 'Escala 6x1',
  variavel: 'Horário variável',
  folga: 'Folga',
  ferias: 'Férias',
  extra: 'Serviço extraordinário',
}

export function defaultWeeklyAvailability(): WeeklyAvailability[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    enabled: dayOfWeek >= 1 && dayOfWeek <= 5,
    startTime: '08:00',
    endTime: '17:00',
    kind: 'normal' as const,
  }))
}

export function emptyAgendaState(): AgendaState {
  return {
    events: [],
    categories: DEFAULT_AGENDA_CATEGORIES.map((c) => ({ ...c })),
    weeklyAvailability: defaultWeeklyAvailability(),
    exceptions: [],
    sleepStart: '23:00',
    sleepEnd: '07:00',
  }
}

export function emptyRecurrence(): AgendaRecurrence {
  return {
    freq: 'none',
    weekdays: [],
    interval: 1,
    untilDateKey: null,
  }
}

export function createAgendaEvent(input: {
  title: string
  description?: string
  dateKey: string
  allDay?: boolean
  startTime?: string | null
  endTime?: string | null
  location?: string
  categoryId?: string
  priority?: AgendaPriority
  color?: string | null
  notes?: string
  reminders?: number[]
  status?: AgendaStatus
  recurrence?: AgendaRecurrence
}): AgendaEvent {
  const now = new Date().toISOString()
  const allDay = Boolean(input.allDay)
  return {
    id: uid('evt'),
    title: input.title.trim() || 'Compromisso',
    description: input.description?.trim() || '',
    dateKey: input.dateKey || dateKey(),
    allDay,
    startTime: allDay ? null : input.startTime || '09:00',
    endTime: allDay ? null : input.endTime || '10:00',
    location: input.location?.trim() || '',
    categoryId: input.categoryId || 'pessoal',
    priority: input.priority || 'media',
    color: input.color ?? null,
    notes: input.notes?.trim() || '',
    reminders: input.reminders?.length ? input.reminders : [15],
    status: input.status || 'pendente',
    recurrence: input.recurrence ?? emptyRecurrence(),
    exceptionDateKeys: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function createAvailabilityException(input: {
  dateKey: string
  kind: WorkShiftKind
  startTime?: string | null
  endTime?: string | null
  note?: string
}): AvailabilityException {
  return {
    id: uid('avail'),
    dateKey: input.dateKey,
    kind: input.kind,
    startTime: input.startTime ?? null,
    endTime: input.endTime ?? null,
    note: input.note?.trim() || '',
  }
}

export function categoryColor(
  categories: AgendaCategory[],
  categoryId: string,
  fallback = '#7a8494',
) {
  return categories.find((c) => c.id === categoryId)?.color ?? fallback
}

export function normalizeAgendaState(raw: unknown): AgendaState {
  const base = emptyAgendaState()
  const parsed =
    raw && typeof raw === 'object' ? (raw as Partial<AgendaState>) : {}

  const categoriesRaw = Array.isArray(parsed.categories)
    ? parsed.categories
    : []
  const categoriesMap = new Map<string, AgendaCategory>()
  for (const c of DEFAULT_AGENDA_CATEGORIES) categoriesMap.set(c.id, { ...c })
  for (const c of categoriesRaw) {
    if (!c || typeof c !== 'object') continue
    const row = c as Partial<AgendaCategory>
    if (typeof row.id !== 'string' || !row.id.trim()) continue
    categoriesMap.set(row.id, {
      id: row.id,
      label: row.label?.trim() || row.id,
      color: row.color?.trim() || '#7a8494',
      builtIn: Boolean(row.builtIn),
    })
  }

  const events = (Array.isArray(parsed.events) ? parsed.events : [])
    .filter((e): e is AgendaEvent => Boolean(e && typeof e === 'object'))
    .map((e) => normalizeEvent(e))
    .filter(Boolean) as AgendaEvent[]

  const weekly =
    Array.isArray(parsed.weeklyAvailability) &&
    parsed.weeklyAvailability.length === 7
      ? parsed.weeklyAvailability.map((row, i) => ({
          dayOfWeek: i,
          enabled: Boolean(row?.enabled),
          startTime: row?.startTime || '08:00',
          endTime: row?.endTime || '17:00',
          kind: (row?.kind as WorkShiftKind) || 'normal',
        }))
      : base.weeklyAvailability

  const exceptions = (
    Array.isArray(parsed.exceptions) ? parsed.exceptions : []
  )
    .filter((x): x is AvailabilityException => Boolean(x && typeof x === 'object'))
    .map((x) => ({
      id: typeof x.id === 'string' ? x.id : uid('avail'),
      dateKey: x.dateKey || dateKey(),
      kind: (x.kind as WorkShiftKind) || 'extra',
      startTime: x.startTime ?? null,
      endTime: x.endTime ?? null,
      note: x.note ?? '',
    }))

  return {
    events,
    categories: [...categoriesMap.values()],
    weeklyAvailability: weekly,
    exceptions,
    sleepStart: parsed.sleepStart || base.sleepStart,
    sleepEnd: parsed.sleepEnd || base.sleepEnd,
  }
}

function normalizeEvent(raw: Partial<AgendaEvent>): AgendaEvent | null {
  if (typeof raw.id !== 'string' || !raw.id) return null
  const title = raw.title?.trim()
  if (!title) return null
  const allDay = Boolean(raw.allDay)
  const recurrence = raw.recurrence ?? emptyRecurrence()
  return {
    id: raw.id,
    title,
    description: raw.description ?? '',
    dateKey: raw.dateKey || dateKey(),
    allDay,
    startTime: allDay ? null : raw.startTime || '09:00',
    endTime: allDay ? null : raw.endTime || '10:00',
    location: raw.location ?? '',
    categoryId: raw.categoryId || 'pessoal',
    priority: raw.priority || 'media',
    color: raw.color ?? null,
    notes: raw.notes ?? '',
    reminders: Array.isArray(raw.reminders) ? raw.reminders.map(Number) : [15],
    status: raw.status || 'pendente',
    recurrence: {
      freq: recurrence.freq || 'none',
      weekdays: Array.isArray(recurrence.weekdays) ? recurrence.weekdays : [],
      interval: Math.max(1, Number(recurrence.interval) || 1),
      untilDateKey: recurrence.untilDateKey ?? null,
    },
    exceptionDateKeys: Array.isArray(raw.exceptionDateKeys)
      ? raw.exceptionDateKeys.filter((k) => typeof k === 'string')
      : [],
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  }
}
