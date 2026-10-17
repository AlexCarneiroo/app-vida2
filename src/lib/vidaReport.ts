import { MUSCLE_LABELS } from '../data/exerciseLibrary'
import { CATEGORY_LABELS } from '../data/financasDefaults'
import { getGameDef } from '../data/jogosDefaults'
import type {
  RecurringBill,
  SavingsGoal,
  Transaction,
} from '../types/financas'
import type { Habit, PersonalGoal } from '../types/habitos'
import type { GameSession } from '../types/jogos'
import type { NutricaoState } from '../types/nutricao'
import type { SaudeState } from '../types/saude'
import type { ActiveWorkout } from '../types/treino'
import { getBillStatus } from './billStatus'
import { dateKey, formatBRL, formatDateBR, startOfWeek } from './date'
import {
  formatWorkoutDurationLabel,
  workoutDurationMinutes,
  workoutSetsDone,
  workoutVolume,
} from './treinoStats'

export type ReportRange = 'week' | 'month' | 'year' | 'custom'

export type ReportSectionId =
  | 'treino'
  | 'habitos'
  | 'financas'
  | 'rotina'
  | 'nutricao'
  | 'saude'
  | 'jogos'

export const REPORT_SECTION_ORDER: ReportSectionId[] = [
  'treino',
  'habitos',
  'financas',
  'rotina',
  'nutricao',
  'saude',
  'jogos',
]

const SECTION_TITLE: Record<ReportSectionId, string> = {
  treino: 'Treino',
  habitos: 'Hábitos',
  financas: 'Finanças',
  rotina: 'Rotina',
  nutricao: 'Nutrição',
  saude: 'Saúde',
  jogos: 'Jogos',
}

const SECTION_PATH: Record<ReportSectionId, string> = {
  treino: '/treino',
  habitos: '/habitos',
  financas: '/financas',
  rotina: '/rotina',
  nutricao: '/nutricao',
  saude: '/saude',
  jogos: '/jogos',
}

function daysInclusive(startKey: string, endKey: string) {
  const [ys, ms, ds] = startKey.split('-').map(Number)
  const [ye, me, de] = endKey.split('-').map(Number)
  const a = new Date(ys, ms - 1, ds)
  const b = new Date(ye, me - 1, de)
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1
}

function isoDay(value: string | null | undefined) {
  if (!value) return ''
  return value.slice(0, 10)
}

export function rangeWindow(
  range: ReportRange,
  now = new Date(),
  custom?: { startKey?: string; endKey?: string },
) {
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  if (range === 'week') {
    start.setTime(startOfWeek(now).getTime())
  } else if (range === 'month' || range === 'custom') {
    start.setDate(1)
  } else {
    start.setMonth(0, 1)
  }

  let startKey = dateKey(start)
  let endKey = dateKey(end)

  if (range === 'custom') {
    const iso = /^\d{4}-\d{2}-\d{2}$/
    if (custom?.startKey && iso.test(custom.startKey)) startKey = custom.startKey
    if (custom?.endKey && iso.test(custom.endKey)) endKey = custom.endKey
    if (startKey > endKey) {
      const swap = startKey
      startKey = endKey
      endKey = swap
    }
  }

  const fmt = new Intl.DateTimeFormat('pt-BR', {
    day: range === 'year' ? undefined : 'numeric',
    month: range === 'year' ? undefined : 'short',
    year: 'numeric',
  })
  const label =
    range === 'year'
      ? String(now.getFullYear())
      : range === 'custom'
        ? `${formatDateBR(startKey)} – ${formatDateBR(endKey)}`
        : `${fmt.format(start)} – ${fmt.format(end)}`

  return {
    start,
    end,
    startKey,
    endKey,
    label,
    days: Math.max(1, daysInclusive(startKey, endKey)),
  }
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

export type ReportRow = { label: string; value: string }

export type ReportSection = {
  id: ReportSectionId
  title: string
  to: string
  headline: string
  caption: string
  note: string
  rows: ReportRow[]
  items: ReportRow[]
  highlight: string | null
  empty: boolean
}

export type VidaReportInput = {
  startKey: string
  endKey: string
  history: ActiveWorkout[]
  habits: Habit[]
  personalGoals: PersonalGoal[]
  habitsLog: Record<string, number>
  rotinaLog: Record<string, number>
  rotinaBlocks: number
  nutri: NutricaoState
  transactions: Transaction[]
  goals: SavingsGoal[]
  bills: RecurringBill[]
  saude: SaudeState
  gameSessions: GameSession[]
}

function num(n: number, digits = 0) {
  return n.toLocaleString('pt-BR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })
}

function topCounts(map: Map<string, number>, limit = 3) {
  return [...map.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .slice(0, limit)
}

function section(
  id: ReportSectionId,
  partial: Omit<ReportSection, 'id' | 'title' | 'to'>,
): ReportSection {
  return {
    id,
    title: SECTION_TITLE[id],
    to: SECTION_PATH[id],
    ...partial,
  }
}

export function buildVidaReport(input: VidaReportInput): ReportSection[] {
  const { startKey, endKey } = input
  const inRange = (key: string) => keyInRange(key, startKey, endKey)

  const sessions = input.history.filter(
    (w) => w.completedAt && inRange(w.dateKey),
  )
  const volume = Math.round(
    sessions.reduce((acc, w) => acc + workoutVolume(w), 0),
  )
  const minutes = sessions.reduce(
    (acc, w) => acc + workoutDurationMinutes(w.startedAt, w.completedAt),
    0,
  )
  const sets = sessions.reduce((acc, w) => acc + workoutSetsDone(w), 0)
  const trainDays = new Set(sessions.map((w) => w.dateKey)).size
  const byName = new Map<string, number>()
  const byMuscle = new Map<string, number>()
  for (const w of sessions) {
    byName.set(w.name, (byName.get(w.name) ?? 0) + 1)
    for (const ex of w.exercises) {
      const done = ex.sets.filter((s) => s.done).length
      if (done <= 0) continue
      const label = MUSCLE_LABELS[ex.muscle] ?? ex.muscle
      byMuscle.set(label, (byMuscle.get(label) ?? 0) + done)
    }
  }
  const topWorkout = topCounts(byName, 1)[0]
  const topMuscle = topCounts(byMuscle, 1)[0]
  const treinoRows: ReportRow[] = [
    { label: 'Tempo', value: minutes > 0 ? formatWorkoutDurationLabel(minutes) : '—' },
    { label: 'Volume', value: volume > 0 ? `${num(volume)} kg` : '—' },
    { label: 'Séries', value: sets > 0 ? num(sets) : '—' },
    { label: 'Dias', value: String(trainDays) },
  ]
  if (topWorkout) {
    treinoRows.push({
      label: 'Plano',
      value: `${topWorkout[0]} · ${topWorkout[1]}×`,
    })
  }
  if (topMuscle) treinoRows.push({ label: 'Foco', value: topMuscle[0] })

  const habits = sumDayLog(input.habitsLog, startKey, endKey)
  const bestHabit = [...input.habits].sort(
    (a, b) => b.streak - a.streak || a.name.localeCompare(b.name, 'pt-BR'),
  )[0]
  const goalsClosed = input.personalGoals.filter((g) =>
    inRange(isoDay(g.completedAt)),
  )
  const goalsOpen = input.personalGoals
    .filter((g) => !g.completedAt && g.target > 0)
    .slice(0, 3)
  const habitRows: ReportRow[] = [
    { label: 'Dias com registo', value: String(habits.days) },
    { label: 'Hábitos ativos', value: String(input.habits.length) },
  ]
  if (bestHabit && bestHabit.streak > 0) {
    habitRows.push({
      label: 'Maior sequência',
      value: `${bestHabit.name} · ${bestHabit.streak}d`,
    })
  }
  if (goalsClosed.length > 0) {
    habitRows.push({
      label: 'Metas fechadas',
      value: String(goalsClosed.length),
    })
  }
  for (const goal of goalsOpen) {
    const pct = Math.min(100, Math.round((goal.current / goal.target) * 100))
    habitRows.push({
      label: goal.name,
      value: `${num(goal.current, goal.current % 1 ? 1 : 0)}/${num(goal.target, goal.target % 1 ? 1 : 0)} ${goal.unit} · ${pct}%`,
    })
  }

  const money = financeReport(input.transactions, startKey, endKey)
  const expenseByCat = new Map<string, number>()
  const movements = input.transactions
    .filter((t) => inRange(t.dateKey))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
  for (const t of movements) {
    if (t.type !== 'expense') continue
    expenseByCat.set(t.category, (expenseByCat.get(t.category) ?? 0) + t.amount)
  }
  const billsInRange = input.bills.filter(
    (b) => b.active && b.payDate && inRange(b.payDate),
  )
  const overdue = input.bills.filter(
    (b) => b.active && getBillStatus(b) === 'overdue',
  )
  const financeRows: ReportRow[] = [
    { label: 'Entradas', value: formatBRL(money.income) },
    { label: 'Saídas', value: formatBRL(money.expense) },
    { label: 'Movimentos', value: String(money.movements) },
  ]
  for (const [cat, total] of topCounts(expenseByCat, 3)) {
    financeRows.push({
      label: CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat,
      value: formatBRL(total),
    })
  }
  if (billsInRange.length > 0) {
    financeRows.push({
      label: 'A pagar no período',
      value: String(billsInRange.length),
    })
  }
  if (overdue.length > 0) {
    financeRows.push({ label: 'Atrasadas agora', value: String(overdue.length) })
  }
  for (const goal of input.goals.slice(0, 2)) {
    const pct = Math.min(100, Math.round((goal.saved / Math.max(1, goal.target)) * 100))
    financeRows.push({
      label: goal.name,
      value: `${formatBRL(goal.saved)} · ${pct}%`,
    })
  }
  const financeItems = movements.slice(0, 24).map((t) => ({
    label: `${formatDateBR(t.dateKey)} · ${CATEGORY_LABELS[t.category]}${t.note ? ` · ${t.note}` : ''}`,
    value: `${t.type === 'income' ? '+' : '−'}${formatBRL(t.amount)}`,
  }))

  const rotina = sumDayLog(input.rotinaLog, startKey, endKey)
  const rotinaAvg =
    rotina.days > 0 ? Math.round((rotina.total / rotina.days) * 10) / 10 : 0

  const entries = (input.nutri.entries ?? []).filter((e) => inRange(e.dateKey))
  const food = sumDayLog(input.nutri.dayLog ?? {}, startKey, endKey)
  let protein = 0
  let carbs = 0
  let fat = 0
  const foodKcal = new Map<string, number>()
  for (const entry of entries) {
    const factor = Math.max(0, entry.grams) / 100
    const kcal = (entry.food.per100.kcal || 0) * factor
    protein += (entry.food.per100.protein || 0) * factor
    carbs += (entry.food.per100.carbs || 0) * factor
    fat += (entry.food.per100.fat || 0) * factor
    foodKcal.set(entry.food.name, (foodKcal.get(entry.food.name) ?? 0) + kcal)
  }
  let waterMl = 0
  let waterDays = 0
  let waterGoalDays = 0
  const waterGoal = input.nutri.waterGoal || 0
  for (const [key, ml] of Object.entries(input.nutri.waterByDay ?? {})) {
    if (!inRange(key) || ml <= 0) continue
    waterMl += ml
    waterDays += 1
    if (waterGoal > 0 && ml >= waterGoal * 0.9) waterGoalDays += 1
  }
  const kcalAvg = food.days > 0 ? Math.round(food.total / food.days) : 0
  const nutriRows: ReportRow[] = [
    {
      label: 'Média',
      value: kcalAvg > 0 ? `${num(kcalAvg)} kcal/dia` : '—',
    },
    { label: 'Refeições', value: String(entries.length) },
    {
      label: 'Proteína',
      value: protein > 0 ? `${num(protein)} g` : '—',
    },
    {
      label: 'Carboidrato',
      value: carbs > 0 ? `${num(carbs)} g` : '—',
    },
    { label: 'Gordura', value: fat > 0 ? `${num(fat)} g` : '—' },
    {
      label: 'Água',
      value:
        waterMl > 0
          ? `${num(waterMl / 1000, 1)} L · ${waterDays}d`
          : '—',
    },
  ]
  if (waterGoal > 0 && waterDays > 0) {
    nutriRows.push({
      label: 'Dias na meta de água',
      value: String(waterGoalDays),
    })
  }
  const foodItems = topCounts(foodKcal, 6).map(([name, kcal]) => ({
    label: name,
    value: `${num(Math.round(kcal))} kcal`,
  }))

  const sleep = input.saude.sleep.filter((s) => inRange(s.dateKey))
  const sleepHours =
    sleep.reduce((acc, s) => acc + (Number(s.hours) || 0), 0) /
    (sleep.length || 1)
  const sleepQuality =
    sleep.reduce((acc, s) => acc + (Number(s.quality) || 0), 0) /
    (sleep.length || 1)
  const checkIns = input.saude.checkIns.filter((c) => inRange(c.dateKey))
  const mood =
    checkIns.reduce((acc, c) => acc + c.mood, 0) / (checkIns.length || 1)
  const energy =
    checkIns.reduce((acc, c) => acc + c.energy, 0) / (checkIns.length || 1)
  const metrics = input.saude.metrics
    .filter((m) => inRange(m.dateKey))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  const exams = input.saude.exams.filter((e) => inRange(e.dateKey))
  const medsOn = input.saude.medications.filter((m) => m.enabled)
  const healthRows: ReportRow[] = [
    {
      label: 'Sono médio',
      value: sleep.length ? `${num(sleepHours, 1)} h` : '—',
    },
    {
      label: 'Qualidade do sono',
      value: sleep.length ? `${num(sleepQuality, 1)}/5` : '—',
    },
    { label: 'Noites', value: String(sleep.length) },
    { label: 'Check-ins', value: String(checkIns.length) },
  ]
  if (checkIns.length > 0) {
    healthRows.push({
      label: 'Humor / energia',
      value: `${num(mood, 1)} · ${num(energy, 1)}`,
    })
  }
  if (metrics.length > 0) {
    const first = metrics[0]
    const last = metrics[metrics.length - 1]
    const delta = Math.round((last.weightKg - first.weightKg) * 10) / 10
    healthRows.push({
      label: 'Peso',
      value:
        metrics.length === 1
          ? `${num(last.weightKg, 1)} kg`
          : `${num(last.weightKg, 1)} kg (${delta > 0 ? '+' : ''}${num(delta, 1)})`,
    })
  }
  if (exams.length > 0) {
    healthRows.push({ label: 'Exames', value: String(exams.length) })
  }
  if (medsOn.length > 0) {
    healthRows.push({ label: 'Medicamentos ativos', value: String(medsOn.length) })
  }
  const healthItems = [...sleep]
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    .slice(0, 10)
    .map((s) => ({
      label: formatDateBR(s.dateKey),
      value: `${num(s.hours, 1)} h · ${s.quality}/5`,
    }))

  const plays = input.gameSessions.filter((s) => inRange(s.dateKey))
  const playMinutes = Math.round(
    plays.reduce((acc, s) => acc + (s.durationSec || 0), 0) / 60,
  )
  const scored = plays.filter((s) => typeof s.score === 'number')
  const avgScore =
    scored.reduce((acc, s) => acc + (s.score || 0), 0) / (scored.length || 1)
  const byGame = new Map<string, number>()
  const skills = new Set<string>()
  for (const play of plays) {
    const def = getGameDef(play.gameId)
    const title = def?.title ?? play.gameId
    byGame.set(title, (byGame.get(title) ?? 0) + 1)
    if (def) skills.add(def.skill)
  }
  const topGame = topCounts(byGame, 1)[0]
  const gameRows: ReportRow[] = [
    {
      label: 'Tempo',
      value: playMinutes > 0 ? formatWorkoutDurationLabel(playMinutes) : '—',
    },
    {
      label: 'Pontuação média',
      value: scored.length ? num(avgScore, 0) : '—',
    },
    { label: 'Dias', value: String(new Set(plays.map((p) => p.dateKey)).size) },
  ]
  if (topGame) gameRows.push({ label: 'Mais jogado', value: topGame[0] })
  if (skills.size > 0) {
    gameRows.push({ label: 'Habilidades', value: String(skills.size) })
  }
  const gameItems = [...plays]
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    .slice(0, 12)
    .map((play) => {
      const def = getGameDef(play.gameId)
      const score = typeof play.score === 'number' ? ` · ${play.score} pts` : ''
      return {
        label: `${formatDateBR(play.dateKey)} · ${def?.title ?? 'Jogo'}`,
        value: `${Math.max(1, Math.round((play.durationSec || 0) / 60))} min${score}`,
      }
    })

  const treinoEmpty = sessions.length === 0
  const habitEmpty = habits.total === 0 && goalsClosed.length === 0
  const moneyEmpty =
    money.movements === 0 && billsInRange.length === 0 && input.goals.length === 0
  const rotinaEmpty = rotina.total === 0
  const foodEmpty = food.total <= 0 && entries.length === 0 && waterMl <= 0
  const healthEmpty =
    sleep.length === 0 &&
    checkIns.length === 0 &&
    metrics.length === 0 &&
    exams.length === 0
  const gamesEmpty = plays.length === 0

  return [
    section('treino', {
      headline: String(sessions.length),
      caption: 'Treinos concluídos',
      note: treinoEmpty
        ? 'Sem treino neste período.'
        : topMuscle
          ? `Foco em ${topMuscle[0].toLowerCase()}.`
          : `${trainDays} dia${trainDays === 1 ? '' : 's'} de treino.`,
      rows: treinoRows,
      items: [...sessions]
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
        .slice(0, 12)
        .map((w) => ({
          label: `${formatDateBR(w.dateKey)} · ${w.name}`,
          value: formatWorkoutDurationLabel(
            workoutDurationMinutes(w.startedAt, w.completedAt),
          ),
        })),
      highlight: treinoEmpty
        ? null
        : `${sessions.length} treino${sessions.length === 1 ? '' : 's'}, ${formatWorkoutDurationLabel(minutes)} no total.`,
      empty: treinoEmpty,
    }),
    section('habitos', {
      headline: String(habits.total),
      caption: 'Hábitos assinalados',
      note: habitEmpty
        ? 'Sem hábito marcado neste período.'
        : `${habits.days} dia${habits.days === 1 ? '' : 's'} com registo.`,
      rows: habitRows,
      items: goalsClosed.slice(0, 6).map((g) => ({
        label: g.name,
        value: 'Meta fechada',
      })),
      highlight:
        bestHabit && bestHabit.streak > 0
          ? `Sequência atual: ${bestHabit.name}, ${bestHabit.streak} dia${bestHabit.streak === 1 ? '' : 's'}.`
          : habits.total > 0
            ? `${habits.total} hábitos assinalados em ${habits.days} dia${habits.days === 1 ? '' : 's'}.`
            : null,
      empty: habitEmpty,
    }),
    section('financas', {
      headline: formatBRL(money.balance),
      caption: 'Saldo do período',
      note: moneyEmpty
        ? 'Sem movimentos neste período.'
        : `+${formatBRL(money.income)} · −${formatBRL(money.expense)}`,
      rows: financeRows,
      items: financeItems,
      highlight: (() => {
        const top = topCounts(expenseByCat, 1)[0]
        if (top) {
          const label =
            CATEGORY_LABELS[top[0] as keyof typeof CATEGORY_LABELS] ?? top[0]
          return `Maior saída: ${label}, ${formatBRL(top[1])}.`
        }
        if (money.income > 0) return `Entradas de ${formatBRL(money.income)}.`
        if (overdue.length > 0) {
          return `${overdue.length} assinatura${overdue.length === 1 ? '' : 's'} atrasada${overdue.length === 1 ? '' : 's'}.`
        }
        return null
      })(),
      empty: moneyEmpty,
    }),
    section('rotina', {
      headline: String(rotina.total),
      caption: 'Blocos de rotina',
      note: rotinaEmpty
        ? 'Sem bloco concluído neste período.'
        : `${rotina.days} dia${rotina.days === 1 ? '' : 's'} · média ${num(rotinaAvg, rotinaAvg % 1 ? 1 : 0)} por dia.`,
      rows: [
        { label: 'Dias', value: String(rotina.days) },
        {
          label: 'Média por dia',
          value: rotina.days > 0 ? num(rotinaAvg, rotinaAvg % 1 ? 1 : 0) : '—',
        },
        { label: 'Blocos no plano', value: String(input.rotinaBlocks) },
      ],
      items: [],
      highlight: rotinaEmpty
        ? null
        : `${rotina.total} bloco${rotina.total === 1 ? '' : 's'} de rotina em ${rotina.days} dia${rotina.days === 1 ? '' : 's'}.`,
      empty: rotinaEmpty,
    }),
    section('nutricao', {
      headline: food.total > 0 ? num(Math.round(food.total)) : '0',
      caption: 'kcal registadas',
      note: foodEmpty
        ? 'Sem refeição ou água neste período.'
        : food.days > 0
          ? `${food.days} dia${food.days === 1 ? '' : 's'} com prato · média ${num(kcalAvg)} kcal.`
          : `${waterDays} dia${waterDays === 1 ? '' : 's'} com água.`,
      rows: nutriRows,
      items: foodItems,
      highlight:
        kcalAvg > 0
          ? `Média de ${num(kcalAvg)} kcal por dia com registo.`
          : waterMl > 0
            ? `${num(waterMl / 1000, 1)} L de água em ${waterDays} dia${waterDays === 1 ? '' : 's'}.`
            : null,
      empty: foodEmpty,
    }),
    section('saude', {
      headline: sleep.length ? `${num(sleepHours, 1)} h` : String(checkIns.length || metrics.length || exams.length),
      caption: sleep.length ? 'Sono médio' : 'Registos de saúde',
      note: healthEmpty
        ? 'Sem sono, peso ou exame neste período.'
        : sleep.length
          ? `${sleep.length} noite${sleep.length === 1 ? '' : 's'} · qualidade ${num(sleepQuality, 1)}/5.`
          : `${checkIns.length} check-in${checkIns.length === 1 ? '' : 's'}.`,
      rows: healthRows,
      items: healthItems,
      highlight: sleep.length
        ? `Sono médio de ${num(sleepHours, 1)} h em ${sleep.length} noite${sleep.length === 1 ? '' : 's'}.`
        : metrics.length > 1
          ? `Peso foi de ${num(metrics[0].weightKg, 1)} kg para ${num(metrics[metrics.length - 1].weightKg, 1)} kg.`
          : null,
      empty: healthEmpty,
    }),
    section('jogos', {
      headline: String(plays.length),
      caption: 'Partidas',
      note: gamesEmpty
        ? 'Sem jogo neste período.'
        : topGame
          ? `${topGame[0]} foi o mais jogado.`
          : `${plays.length} partida${plays.length === 1 ? '' : 's'}.`,
      rows: gameRows,
      items: gameItems,
      highlight: gamesEmpty
        ? null
        : `${plays.length} partida${plays.length === 1 ? '' : 's'}${playMinutes > 0 ? `, ${formatWorkoutDurationLabel(playMinutes)}` : ''}.`,
      empty: gamesEmpty,
    }),
  ]
}

export function reportHighlights(sections: ReportSection[]) {
  return sections
    .map((s) => s.highlight)
    .filter((line): line is string => Boolean(line))
    .slice(0, 4)
}
