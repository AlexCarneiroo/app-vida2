import { dateKey, shiftDateKey, uid } from './date'
import { parseTimeToMinutes, minutesToTime } from './agendaEngine'
import type {
  NapEntry,
  SleepChallenge,
  SleepChallengeKind,
  SleepEntry,
  SleepHabitFlags,
  SleepQuality,
} from '../types/saude'
import type { HealthInsight } from '../data/saudeDefaults'
import {
  DEFAULT_SLEEP_ROUTINE,
  sleepForDay,
  sleepHoursBetween,
} from '../data/saudeDefaults'

export { DEFAULT_SLEEP_ROUTINE }

export function createNap(input: {
  dateKey?: string
  startTime: string
  endTime: string
  note?: string
}): NapEntry | null {
  const start = parseTimeToMinutes(input.startTime)
  const end = parseTimeToMinutes(input.endTime)
  if (start === null || end === null) return null
  let minutes = end - start
  if (minutes <= 0) minutes += 24 * 60
  if (minutes > 4 * 60) minutes = 4 * 60
  return {
    id: uid('nap'),
    dateKey: input.dateKey || dateKey(),
    startTime: input.startTime,
    endTime: input.endTime,
    minutes,
    note: input.note?.trim() || undefined,
    createdAt: new Date().toISOString(),
  }
}

export type SleepRangeStats = {
  days: number
  logged: number
  avgHours: number | null
  avgQuality: number | null
  avgReadiness: number | null
  avgLatency: number | null
  avgAwakenings: number | null
  goalHitDays: number
  goalHours: number
  bedRegularityMin: number | null
  wakeRegularityMin: number | null
  habitRates: {
    phoneBeforeBed: number
    caffeineLate: number
    exerciseLate: number
    alcohol: number
    heavyMeal: number
  }
  streak: number
  entries: SleepEntry[]
}

function avg(nums: number[]) {
  if (!nums.length) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
}

function stdDevMinutes(times: string[]) {
  const mins = times
    .map((t) => parseTimeToMinutes(t))
    .filter((m): m is number => m !== null)
  if (mins.length < 2) return null
  // Circular-ish for bedtime: keep as linear for simplicity near typical range
  const mean = mins.reduce((a, b) => a + b, 0) / mins.length
  const variance =
    mins.reduce((a, m) => a + (m - mean) ** 2, 0) / mins.length
  return Math.round(Math.sqrt(variance))
}

export function sleepRangeStats(
  sleep: SleepEntry[],
  today: string,
  days: number,
  goalHours: number,
): SleepRangeStats {
  const keys = Array.from({ length: days }, (_, i) =>
    shiftDateKey(today, i - (days - 1)),
  )
  const entries = keys
    .map((k) => sleepForDay(sleep, k))
    .filter((e): e is SleepEntry => Boolean(e))

  const goalHitDays = entries.filter(
    (e) =>
      e.hours >= goalHours - 0.5 && e.hours <= goalHours + 1.5,
  ).length

  let streak = 0
  for (let i = 0; i < 60; i++) {
    const key = shiftDateKey(today, -i)
    const entry = sleepForDay(sleep, key)
    if (
      !entry ||
      entry.hours < goalHours - 0.5 ||
      entry.hours > goalHours + 1.5
    ) {
      break
    }
    streak += 1
  }

  const withHabits = entries.filter((e) => e.habits)
  const rate = (key: keyof SleepHabitFlags) => {
    if (!withHabits.length) return 0
    return Math.round(
      (withHabits.filter((e) => e.habits?.[key]).length / withHabits.length) *
        100,
    )
  }

  return {
    days,
    logged: entries.length,
    avgHours: avg(entries.map((e) => e.hours)),
    avgQuality: avg(entries.map((e) => e.quality)),
    avgReadiness: avg(
      entries
        .map((e) => e.readiness)
        .filter((v): v is SleepQuality => typeof v === 'number'),
    ),
    avgLatency: avg(
      entries
        .map((e) => e.latencyMin)
        .filter((v): v is number => typeof v === 'number'),
    ),
    avgAwakenings: avg(
      entries
        .map((e) => e.awakenings)
        .filter((v): v is number => typeof v === 'number'),
    ),
    goalHitDays,
    goalHours,
    bedRegularityMin: stdDevMinutes(
      entries.map((e) => e.bedTime).filter((t): t is string => Boolean(t)),
    ),
    wakeRegularityMin: stdDevMinutes(
      entries.map((e) => e.wakeTime).filter((t): t is string => Boolean(t)),
    ),
    habitRates: {
      phoneBeforeBed: rate('phoneBeforeBed'),
      caffeineLate: rate('caffeineLate'),
      exerciseLate: rate('exerciseLate'),
      alcohol: rate('alcohol'),
      heavyMeal: rate('heavyMeal'),
    },
    streak,
    entries,
  }
}

export function challengeProgress(
  sleep: SleepEntry[],
  challenge: SleepChallenge | null,
  today: string,
  goalHours: number,
) {
  if (!challenge?.active) {
    return { current: 0, target: 0, pct: 0, done: false }
  }
  const target = challenge.kind
  let current = 0
  for (let i = 0; i < target; i++) {
    const key = shiftDateKey(challenge.startDateKey, i)
    if (key > today) break
    const entry = sleepForDay(sleep, key)
    if (
      entry &&
      entry.hours >= goalHours - 0.5 &&
      entry.hours <= goalHours + 1.5
    ) {
      current += 1
    }
  }
  const done = current >= target
  return {
    current,
    target,
    pct: Math.min(100, Math.round((current / target) * 100)),
    done,
  }
}

export function startChallenge(
  kind: SleepChallengeKind,
  today: string,
): SleepChallenge {
  return {
    id: uid('sch'),
    kind,
    startDateKey: today,
    active: true,
    completedDateKey: null,
  }
}

export function buildRichSleepInsights(input: {
  stats7: SleepRangeStats
  stats30: SleepRangeStats
  sleepDebt: number
  tonight: SleepEntry | null
  napsTodayMin: number
  agendaHint: string | null
}): HealthInsight[] {
  const list: HealthInsight[] = []
  const { stats7, stats30, sleepDebt, tonight, napsTodayMin, agendaHint } =
    input

  if (stats7.logged === 0) {
    list.push({
      id: 'sleep-start',
      tone: 'info',
      title: 'Primeiro registo',
      body: 'Anota deitar, acordar e como te sentiste. Em 3 noites já aparece o teu padrão.',
    })
    return list
  }

  if (stats7.avgHours != null) {
    const onGoal =
      stats7.avgHours >= stats7.goalHours - 0.5 &&
      stats7.avgHours <= stats7.goalHours + 1
    list.push({
      id: 'avg7',
      tone: onGoal ? 'ok' : stats7.avgHours < 6.5 ? 'warn' : 'info',
      title: 'Média da semana',
      body: `${stats7.avgHours}h · qualidade ${stats7.avgQuality ?? '—'}/5 · meta ${stats7.goalHours}h (${stats7.goalHitDays}/${stats7.logged} noites no alvo).`,
    })
  }

  if (sleepDebt >= 3) {
    list.push({
      id: 'debt',
      tone: 'warn',
      title: 'Débito acumulado',
      body: `~${sleepDebt}h em falta vs ~7.5h. Antecipa o deitar 30–45 min nas próximas 2 noites.`,
    })
  }

  if (stats7.avgLatency != null && stats7.avgLatency >= 30) {
    list.push({
      id: 'latency',
      tone: 'warn',
      title: 'Demoras a adormecer',
      body: `Média de ${stats7.avgLatency} min até dormir. Experimenta ecrã off 45 min antes e luz mais baixa.`,
    })
  }

  if (stats7.avgAwakenings != null && stats7.avgAwakenings >= 2) {
    list.push({
      id: 'awakenings',
      tone: 'info',
      title: 'Despertares noturnos',
      body: `Média de ${stats7.avgAwakenings} despertares. Evita líquidos em excesso e refeições pesadas perto da cama.`,
    })
  }

  if (stats7.habitRates.phoneBeforeBed >= 50) {
    list.push({
      id: 'phone',
      tone: 'warn',
      title: 'Telemóvel antes de dormir',
      body: `Em ${stats7.habitRates.phoneBeforeBed}% das noites usaste ecrã. A luz e o estímulo atrasam o adormecer.`,
    })
  }

  if (stats7.habitRates.caffeineLate >= 40) {
    list.push({
      id: 'caffeine',
      tone: 'warn',
      title: 'Cafeína tarde',
      body: `Marcado em ${stats7.habitRates.caffeineLate}% das noites. Cafeína depois das 15h reduz a profundidade do descanso.`,
    })
  }

  if (stats7.bedRegularityMin != null && stats7.bedRegularityMin > 60) {
    list.push({
      id: 'irregular',
      tone: 'info',
      title: 'Horário irregular',
      body: `A hora de deitar varia ~${stats7.bedRegularityMin} min. Regularidade ajuda mais do que “recuperar” no fim de semana.`,
    })
  }

  if (napsTodayMin >= 45) {
    list.push({
      id: 'nap-long',
      tone: 'info',
      title: 'Cochilo longo',
      body: `${napsTodayMin} min de cochilo hoje. Se atrasar o sono noturno, limita a 20–30 min antes das 16h.`,
    })
  }

  if (tonight?.readiness != null && tonight.readiness <= 2) {
    list.push({
      id: 'low-ready',
      tone: 'warn',
      title: 'Disposição fraca ao acordar',
      body: 'Hoje acordaste sem energia. Prioriza a rotina noturna e a meta de horas esta noite.',
    })
  }

  if (stats30.streak >= 5) {
    list.push({
      id: 'streak',
      tone: 'ok',
      title: 'Sequência forte',
      body: `${stats30.streak} noites seguidas na meta. Mantém a rotina — consistência é o melhor “hack”.`,
    })
  }

  if (agendaHint) {
    list.push({
      id: 'agenda',
      tone: 'info',
      title: 'Sugestão da agenda',
      body: agendaHint,
    })
  }

  return list.slice(0, 7)
}

/** Sugere deitar/acordar com base no 1.º compromisso e/ou expediente. */
export function suggestSleepFromAgenda(input: {
  goalHours: number
  workStart: string | null
  firstEventStart: string | null
  windDownMinutes: number
}): { bedTime: string; wakeTime: string; reason: string } | null {
  const wakeCandidates = [input.firstEventStart, input.workStart]
    .map((t) => (t ? parseTimeToMinutes(t) : null))
    .filter((m): m is number => m !== null)
  if (!wakeCandidates.length) return null

  const firstBusy = Math.min(...wakeCandidates)
  const prep = 60 // tempo para acordar + deslocar
  const wakeMin = Math.max(5 * 60, firstBusy - prep)
  const bedMin = wakeMin - Math.round(input.goalHours * 60)
  const bedNorm = ((bedMin % (24 * 60)) + 24 * 60) % (24 * 60)
  const wind = minutesToTime(
    (bedNorm - input.windDownMinutes + 24 * 60) % (24 * 60),
  )

  return {
    wakeTime: minutesToTime(wakeMin),
    bedTime: minutesToTime(bedNorm),
    reason: `Com o 1.º compromisso/expediente às ${minutesToTime(firstBusy)}, sugere acordar às ${minutesToTime(wakeMin)} e deitar às ${minutesToTime(bedNorm)} (~${input.goalHours}h). Começa a rotina por volta das ${wind}.`,
  }
}

export function monthSleepCells(
  sleep: SleepEntry[],
  anchor: Date,
): { dateKey: string; inMonth: boolean; entry: SleepEntry | null }[] {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const first = new Date(year, month, 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const key = dateKey(d)
    return {
      dateKey: key,
      inMonth: d.getMonth() === month,
      entry: sleepForDay(sleep, key),
    }
  })
}

export { sleepHoursBetween }
