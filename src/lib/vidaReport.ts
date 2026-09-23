import { dateKey, startOfWeek } from './date'
import { workoutVolume } from './treinoStats'
import type { Transaction } from '../types/financas'
import type { ActiveWorkout } from '../types/treino'

export type ReportRange = 'week' | 'month' | 'year'

export function rangeWindow(range: ReportRange, now = new Date()) {
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  if (range === 'week') {
    const weekStart = startOfWeek(now)
    start.setTime(weekStart.getTime())
  } else if (range === 'month') {
    start.setDate(1)
  } else {
    start.setMonth(0, 1)
  }

  const startKey = dateKey(start)
  const endKey = dateKey(end)
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    day: range === 'year' ? undefined : 'numeric',
    month: range === 'year' ? undefined : 'short',
    year: 'numeric',
  })
  const label =
    range === 'year'
      ? String(now.getFullYear())
      : `${fmt.format(start)} – ${fmt.format(end)}`

  return { start, end, startKey, endKey, label }
}

export function keyInRange(key: string, startKey: string, endKey: string) {
  return Boolean(key) && key >= startKey && key <= endKey
}

export function sumDayLog(
  log: Record<string, number>,
  startKey: string,
  endKey: string,
) {
  let total = 0
  let days = 0
  for (const [key, value] of Object.entries(log)) {
    if (!keyInRange(key, startKey, endKey) || value <= 0) continue
    total += value
    days += 1
  }
  return { total, days }
}

export function treinoReport(
  history: ActiveWorkout[],
  startKey: string,
  endKey: string,
) {
  const sessions = history.filter(
    (w) => w.completedAt && keyInRange(w.dateKey, startKey, endKey),
  )
  const volume = sessions.reduce((acc, w) => acc + workoutVolume(w), 0)
  return {
    sessions: sessions.length,
    volume: Math.round(volume),
  }
}

export function financeReport(
  transactions: Transaction[],
  startKey: string,
  endKey: string,
) {
  let income = 0
  let expense = 0
  for (const t of transactions) {
    if (!keyInRange(t.dateKey, startKey, endKey)) continue
    if (t.type === 'income') income += t.amount
    else expense += t.amount
  }
  return {
    income,
    expense,
    balance: income - expense,
    movements: transactions.filter((t) =>
      keyInRange(t.dateKey, startKey, endKey),
    ).length,
  }
}
