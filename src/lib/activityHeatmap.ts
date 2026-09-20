import { useMemo } from 'react'
import { dateKey } from '../lib/date'

export type DayActivity = Record<string, number>

/** Soma vários mapas dia → contagem. */
export function mergeDayLogs(...logs: DayActivity[]): DayActivity {
  const out: DayActivity = {}
  for (const log of logs) {
    for (const [k, v] of Object.entries(log)) {
      if (v > 0) out[k] = (out[k] ?? 0) + v
    }
  }
  return out
}

export function treinoDayLog(
  history: Array<{ dateKey: string; completedAt?: string }>,
): DayActivity {
  const out: DayActivity = {}
  for (const w of history) {
    if (!w.completedAt && !w.dateKey) continue
    const k = w.dateKey
    if (!k) continue
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

export function financasDayLog(
  transactions: Array<{ dateKey: string }>,
): DayActivity {
  const out: DayActivity = {}
  for (const t of transactions) {
    if (!t.dateKey) continue
    out[t.dateKey] = (out[t.dateKey] ?? 0) + 1
  }
  return out
}

export type HeatmapCell = {
  dateKey: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
  inRange: boolean
}

export type HeatmapModel = {
  weeks: HeatmapCell[][]
  monthLabels: Array<{ label: string; weekIndex: number }>
  total: number
  year: number
}

function parseKey(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Nível 0–4 a partir da contagem e do máximo do período. */
export function activityLevel(
  count: number,
  max: number,
): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0
  if (max <= 1) return 4
  const ratio = count / max
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

/**
 * Grelha estilo GitHub: 7 linhas (dom→sáb), ~53 semanas até hoje.
 */
export function buildHeatmap(
  log: DayActivity,
  weeksCount = 53,
): HeatmapModel {
  const today = parseKey(dateKey())
  today.setHours(0, 0, 0, 0)

  // Domingo da semana atual
  const endSunday = addDays(today, -today.getDay())
  // Primeiro domingo do intervalo
  const start = addDays(endSunday, -(weeksCount - 1) * 7)

  const values = Object.values(log)
  const max = values.length ? Math.max(...values) : 0

  let total = 0
  const weeks: HeatmapCell[][] = []

  for (let w = 0; w < weeksCount; w++) {
    const col: HeatmapCell[] = []
    for (let dow = 0; dow < 7; dow++) {
      const day = addDays(start, w * 7 + dow)
      const key = dateKey(day)
      const inRange = day.getTime() <= today.getTime()
      const count = inRange ? log[key] ?? 0 : 0
      if (count > 0) total += count
      col.push({
        dateKey: key,
        count,
        level: inRange ? activityLevel(count, max) : 0,
        inRange,
      })
    }
    weeks.push(col)
  }

  const monthLabels: Array<{ label: string; weekIndex: number }> = []
  let lastMonth = -1
  const fmt = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
  for (let w = 0; w < weeks.length; w++) {
    const first = parseKey(weeks[w][0].dateKey)
    const m = first.getMonth()
    if (m !== lastMonth) {
      monthLabels.push({
        label: fmt.format(first).replace('.', ''),
        weekIndex: w,
      })
      lastMonth = m
    }
  }

  return {
    weeks,
    monthLabels,
    total,
    year: today.getFullYear(),
  }
}

export function useHeatmapModel(log: DayActivity, weeksCount = 53) {
  return useMemo(() => buildHeatmap(log, weeksCount), [log, weeksCount])
}
