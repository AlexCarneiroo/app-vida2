import { categoryColor } from '../data/agendaDefaults'
import { dateKey, shiftDateKey } from './date'
import type {
  AgendaCategory,
  AgendaEvent,
  AgendaItem,
  AgendaListRange,
  AgendaState,
  AgendaStatus,
  AvailabilityException,
  WeeklyAvailability,
} from '../types/agenda'
import type { Habit } from '../types/habitos'
import type { RoutineBlock } from '../types/rotina'
import type { WorkoutTemplate } from '../types/treino'
import { isHabitDueOn } from '../data/habitosDefaults'

export function parseTimeToMinutes(time: string | null | undefined) {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

export function minutesToTime(total: number) {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function monthGrid(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export function eventOccursOn(event: AgendaEvent, day: string): boolean {
  if (event.exceptionDateKeys.includes(day)) return false
  if (event.recurrence.freq === 'none') return event.dateKey === day
  if (day < event.dateKey) return false
  if (event.recurrence.untilDateKey && day > event.recurrence.untilDateKey) {
    return false
  }

  const start = new Date(`${event.dateKey}T12:00:00`)
  const current = new Date(`${day}T12:00:00`)
  const diffDays = Math.round(
    (current.getTime() - start.getTime()) / 86_400_000,
  )
  const interval = Math.max(1, event.recurrence.interval || 1)

  switch (event.recurrence.freq) {
    case 'daily':
      return diffDays % interval === 0
    case 'weekly': {
      const days =
        event.recurrence.weekdays.length > 0
          ? event.recurrence.weekdays
          : [start.getDay()]
      if (!days.includes(current.getDay())) return false
      const weeks = Math.floor(diffDays / 7)
      return weeks % interval === 0
    }
    case 'monthly':
      return (
        current.getDate() === start.getDate() &&
        (current.getFullYear() * 12 + current.getMonth() -
          (start.getFullYear() * 12 + start.getMonth())) %
          interval ===
          0
      )
    case 'yearly':
      return (
        current.getDate() === start.getDate() &&
        current.getMonth() === start.getMonth() &&
        (current.getFullYear() - start.getFullYear()) % interval === 0
      )
    case 'custom': {
      const days = event.recurrence.weekdays
      if (days.length === 0) return diffDays % interval === 0
      return days.includes(current.getDay())
    }
    default:
      return event.dateKey === day
  }
}

export function expandEvents(
  events: AgendaEvent[],
  fromKey: string,
  toKey: string,
  categories: AgendaCategory[],
): AgendaItem[] {
  const items: AgendaItem[] = []
  let cursor = fromKey
  while (cursor <= toKey) {
    for (const event of events) {
      if (!eventOccursOn(event, cursor)) continue
      const status = resolveStatus(event, cursor)
      items.push({
        id: `${event.id}:${cursor}`,
        source: 'event',
        sourceId: event.id,
        title: event.title,
        detail: event.location || event.description || event.notes,
        dateKey: cursor,
        allDay: event.allDay,
        startTime: event.startTime,
        endTime: event.endTime,
        categoryId: event.categoryId,
        color: event.color || categoryColor(categories, event.categoryId),
        status,
        editable: true,
        priority: event.priority,
      })
    }
    cursor = shiftDateKey(cursor, 1)
  }
  return items
}

function resolveStatus(event: AgendaEvent, day: string): AgendaStatus {
  if (event.status === 'cancelado' || event.status === 'concluido') {
    return event.status
  }
  if (event.allDay) return event.status
  const end = parseTimeToMinutes(event.endTime)
  const now = new Date()
  const today = dateKey(now)
  if (day < today) return 'atrasado'
  if (day === today && end !== null) {
    const nowMins = now.getHours() * 60 + now.getMinutes()
    if (nowMins > end && event.status === 'pendente') return 'atrasado'
  }
  return event.status
}

export function buildDerivedItems(input: {
  fromKey: string
  toKey: string
  plan: WorkoutTemplate[]
  weekDone: Record<string, string>
  habits: Habit[]
  rotinaBlocks: RoutineBlock[]
  todayKey: string
}): AgendaItem[] {
  const items: AgendaItem[] = []
  let cursor = input.fromKey
  while (cursor <= input.toKey) {
    const dow = new Date(`${cursor}T12:00:00`).getDay()
    const template = input.plan.find((t) => t.dayOfWeek === dow)
    if (template) {
      const done = Boolean(input.weekDone[cursor])
      items.push({
        id: `treino:${template.id}:${cursor}`,
        source: 'treino',
        sourceId: template.id,
        title: template.name,
        detail: template.focus
          ? `${template.focus} · ~${template.estimatedMin} min`
          : `~${template.estimatedMin} min`,
        dateKey: cursor,
        allDay: false,
        startTime: '07:00',
        endTime: minutesToTime(7 * 60 + Math.max(30, template.estimatedMin)),
        categoryId: 'treino',
        color: '#3d9b7a',
        status: done ? 'concluido' : 'pendente',
        editable: false,
        priority: 'media',
      })
    }

    for (const habit of input.habits) {
      if (!isHabitDueOn(habit, cursor)) continue
      const done =
        cursor === input.todayKey
          ? habit.doneToday || habit.skippedToday
          : habit.lastDoneDateKey === cursor || habit.lastSkipDateKey === cursor
      items.push({
        id: `habito:${habit.id}:${cursor}`,
        source: 'habito',
        sourceId: habit.id,
        title: habit.name,
        detail: habit.detail || 'Hábito',
        dateKey: cursor,
        allDay: !habit.preferredTime,
        startTime: habit.preferredTime,
        endTime: habit.preferredTime
          ? minutesToTime((parseTimeToMinutes(habit.preferredTime) ?? 0) + 30)
          : null,
        categoryId: habit.category === 'corpo' ? 'treino' : 'pessoal',
        color: '#c4a484',
        status: done ? 'concluido' : 'pendente',
        editable: false,
        priority: 'baixa',
      })
    }

    for (const block of input.rotinaBlocks) {
      const start = parseTimeToMinutes(block.time) ?? 8 * 60
      items.push({
        id: `rotina:${block.id}:${cursor}`,
        source: 'rotina',
        sourceId: block.id,
        title: block.title,
        detail: block.detail || 'Rotina',
        dateKey: cursor,
        allDay: false,
        startTime: block.time,
        endTime: minutesToTime(start + 30),
        categoryId: 'pessoal',
        color: '#7eb8ff',
        status:
          cursor === input.todayKey && block.doneToday
            ? 'concluido'
            : 'pendente',
        editable: false,
        priority: 'baixa',
      })
    }

    cursor = shiftDateKey(cursor, 1)
  }
  return items
}

export function sortAgendaItems(a: AgendaItem, b: AgendaItem) {
  if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey)
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
  return (a.startTime || '99:99').localeCompare(b.startTime || '99:99')
}

export type AgendaConflict = {
  id: string
  a: AgendaItem
  b: AgendaItem
  overlapMinutes: number
}

export function findConflicts(items: AgendaItem[]): AgendaConflict[] {
  const timed = items.filter(
    (i) =>
      !i.allDay &&
      i.status !== 'cancelado' &&
      i.startTime &&
      i.endTime,
  )
  const conflicts: AgendaConflict[] = []
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i]
      const b = timed[j]
      if (a.dateKey !== b.dateKey) continue
      const aStart = parseTimeToMinutes(a.startTime)!
      const aEnd = parseTimeToMinutes(a.endTime)!
      const bStart = parseTimeToMinutes(b.startTime)!
      const bEnd = parseTimeToMinutes(b.endTime)!
      const start = Math.max(aStart, bStart)
      const end = Math.min(aEnd, bEnd)
      if (end > start) {
        conflicts.push({
          id: `${a.id}|${b.id}`,
          a,
          b,
          overlapMinutes: end - start,
        })
      }
    }
  }
  return conflicts
}

export function availabilityForDay(
  state: AgendaState,
  day: string,
): {
  busy: boolean
  label: string
  startTime: string | null
  endTime: string | null
  exception: AvailabilityException | null
  weekly: WeeklyAvailability
} {
  const dow = new Date(`${day}T12:00:00`).getDay()
  const weekly =
    state.weeklyAvailability.find((w) => w.dayOfWeek === dow) ??
    state.weeklyAvailability[dow]
  const exception =
    state.exceptions.find((e) => e.dateKey === day) ?? null

  if (exception) {
    const off =
      exception.kind === 'folga' || exception.kind === 'ferias'
    return {
      busy: !off,
      label: exception.note || exception.kind,
      startTime: off ? null : exception.startTime,
      endTime: off ? null : exception.endTime,
      exception,
      weekly,
    }
  }

  return {
    busy: weekly.enabled,
    label: weekly.enabled ? weekly.kind : 'folga',
    startTime: weekly.enabled ? weekly.startTime : null,
    endTime: weekly.enabled ? weekly.endTime : null,
    exception: null,
    weekly,
  }
}

export function listRangeKeys(
  range: AgendaListRange,
  today = dateKey(),
  customFrom?: string,
  customTo?: string,
) {
  if (range === 'today') return { from: today, to: today }
  if (range === 'tomorrow') {
    const t = shiftDateKey(today, 1)
    return { from: t, to: t }
  }
  if (range === 'week') {
    const d = new Date(`${today}T12:00:00`)
    const start = shiftDateKey(today, -d.getDay())
    return { from: start, to: shiftDateKey(start, 6) }
  }
  if (range === 'next7') {
    return { from: today, to: shiftDateKey(today, 6) }
  }
  if (range === 'month') {
    const d = new Date(`${today}T12:00:00`)
    const from = dateKey(new Date(d.getFullYear(), d.getMonth(), 1))
    const to = dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0))
    return { from, to }
  }
  return {
    from: customFrom || today,
    to: customTo || shiftDateKey(today, 30),
  }
}

export function dayLoadScore(items: AgendaItem[]) {
  const timed = items.filter((i) => !i.allDay && i.status !== 'cancelado')
  const minutes = timed.reduce((acc, item) => {
    const start = parseTimeToMinutes(item.startTime)
    const end = parseTimeToMinutes(item.endTime)
    if (start === null || end === null) return acc
    return acc + Math.max(0, end - start)
  }, 0)
  return {
    count: items.filter((i) => i.status !== 'cancelado').length,
    minutes,
    overloaded: timed.length >= 8 || minutes >= 10 * 60,
  }
}
