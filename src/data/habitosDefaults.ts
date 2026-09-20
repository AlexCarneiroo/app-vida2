import { dateKey, startOfWeek, uid } from '../lib/date'
import type {
  Habit,
  HabitCategory,
  HabitFrequency,
  HabitGoalKind,
  HabitInput,
  HabitosState,
} from '../types/habitos'

export const HABIT_CATEGORY_LABELS: Record<HabitCategory, string> = {
  saude: 'Saúde',
  mente: 'Mente',
  corpo: 'Corpo',
  produtividade: 'Foco',
  social: 'Social',
  financeiro: 'Dinheiro',
  outro: 'Outro',
}

export const HABIT_FREQUENCY_LABELS: Record<HabitFrequency, string> = {
  daily: 'Todos os dias',
  weekdays: 'Dias úteis',
  weekends: 'Fim de semana',
  custom: 'Dias à escolha',
}

export const HABIT_FREEZES_PER_WEEK = 2

export const HABIT_QUICK_IDEAS: Array<{
  name: string
  category: HabitCategory
  detail: string
  goalKind: HabitGoalKind
  goalTarget: number
}> = [
  {
    name: 'Beber água',
    category: 'saude',
    detail: 'Hidratação ao longo do dia',
    goalKind: 'count',
    goalTarget: 8,
  },
  {
    name: 'Meditar',
    category: 'mente',
    detail: '5–10 minutos em silêncio',
    goalKind: 'check',
    goalTarget: 1,
  },
  {
    name: 'Caminhar',
    category: 'corpo',
    detail: 'Movimento leve',
    goalKind: 'check',
    goalTarget: 1,
  },
  {
    name: 'Ler',
    category: 'mente',
    detail: 'Páginas ou minutos',
    goalKind: 'check',
    goalTarget: 1,
  },
  {
    name: 'Sem redes sociais',
    category: 'produtividade',
    detail: 'Manhã sem scroll',
    goalKind: 'check',
    goalTarget: 1,
  },
]

/** Inferência simples a partir do nome digitado */
export function suggestCategory(name: string): HabitCategory {
  const t = name.toLowerCase()
  if (/água|agua|sono|dorm|vitamina|remédio|remedio|saúde|saude/.test(t))
    return 'saude'
  if (/medit|ler|jornal|diário|diario|gratid|respir|mind/.test(t)) return 'mente'
  if (/caminh|corr|treino|along|flex|muscul|yoga|exerc/.test(t)) return 'corpo'
  if (/estud|trabalh|foco|ler email|inbox|escrev|código|codigo/.test(t))
    return 'produtividade'
  if (/ligar|família|familia|amigo|social|mensagem/.test(t)) return 'social'
  if (/poupar|orçamento|orcamento|investir|gasto/.test(t)) return 'financeiro'
  return 'outro'
}

export function weekKey(d = new Date()) {
  return dateKey(startOfWeek(d))
}

export function isHabitDueOn(habit: Habit, key: string): boolean {
  const [y, m, day] = key.split('-').map(Number)
  const date = new Date(y, m - 1, day)
  const dow = date.getDay()
  switch (habit.frequency) {
    case 'daily':
      return true
    case 'weekdays':
      return dow >= 1 && dow <= 5
    case 'weekends':
      return dow === 0 || dow === 6
    case 'custom':
      return (habit.customDays ?? []).includes(dow)
    default:
      return true
  }
}

export function createHabit(input: HabitInput | string, detail = ''): Habit {
  const data: HabitInput =
    typeof input === 'string' ? { name: input, detail } : input

  const goalKind = data.goalKind ?? 'check'
  const goalTarget =
    goalKind === 'count'
      ? Math.max(1, Math.min(99, Number(data.goalTarget) || 1))
      : 1

  return {
    id: uid('hab'),
    name: (data.name ?? '').trim() || 'Novo hábito',
    detail: (data.detail ?? '').trim(),
    category: data.category ?? suggestCategory(data.name ?? ''),
    frequency: data.frequency ?? 'daily',
    customDays: data.customDays?.length ? [...data.customDays] : [1, 2, 3, 4, 5],
    goalKind,
    goalTarget,
    progressToday: 0,
    preferredTime: data.preferredTime?.trim() || null,
    reminderEnabled: Boolean(data.reminderEnabled),
    reminderTime:
      data.reminderEnabled
        ? data.reminderTime?.trim() || data.preferredTime?.trim() || '09:00'
        : data.reminderTime?.trim() || null,
    linkedGoalId: data.linkedGoalId?.trim() || null,
    goalBoostAmount: Math.max(0, Number(data.goalBoostAmount) || 0),
    streak: 0,
    bestStreak: 0,
    doneToday: false,
    skippedToday: false,
    lastDoneDateKey: null,
    lastSkipDateKey: null,
    freezesLeft: HABIT_FREEZES_PER_WEEK,
    freezesWeekKey: weekKey(),
    createdAt: new Date().toISOString(),
  }
}

export function normalizeHabit(raw: Partial<Habit> & { id: string }): Habit {
  const base = createHabit(raw.name || 'Hábito', raw.detail || '')
  const goalKind: HabitGoalKind =
    raw.goalKind === 'count' ? 'count' : 'check'
  const goalTarget =
    goalKind === 'count'
      ? Math.max(1, Math.min(99, Number(raw.goalTarget) || 1))
      : 1
  const progressToday = Math.max(
    0,
    Math.min(goalTarget, Number(raw.progressToday) || (raw.doneToday ? goalTarget : 0)),
  )
  return {
    ...base,
    id: raw.id,
    name: raw.name?.trim() || base.name,
    detail: raw.detail ?? '',
    category: (raw.category as HabitCategory) || base.category,
    frequency: (raw.frequency as HabitFrequency) || 'daily',
    customDays: Array.isArray(raw.customDays)
      ? raw.customDays.filter((d) => d >= 0 && d <= 6)
      : base.customDays,
    goalKind,
    goalTarget,
    progressToday,
    preferredTime: raw.preferredTime ?? null,
    reminderEnabled: Boolean(raw.reminderEnabled),
    reminderTime: raw.reminderTime ?? null,
    linkedGoalId:
      typeof raw.linkedGoalId === 'string' && raw.linkedGoalId.trim()
        ? raw.linkedGoalId.trim()
        : null,
    goalBoostAmount: Math.max(0, Number(raw.goalBoostAmount) || 0),
    streak: Math.max(0, Number(raw.streak) || 0),
    bestStreak: Math.max(
      0,
      Number(raw.bestStreak) || Number(raw.streak) || 0,
    ),
    doneToday: Boolean(raw.doneToday) || progressToday >= goalTarget,
    skippedToday: Boolean(raw.skippedToday),
    lastDoneDateKey: raw.lastDoneDateKey ?? null,
    lastSkipDateKey: raw.lastSkipDateKey ?? null,
    freezesLeft: Math.max(
      0,
      Number.isFinite(Number(raw.freezesLeft))
        ? Number(raw.freezesLeft)
        : HABIT_FREEZES_PER_WEEK,
    ),
    freezesWeekKey: raw.freezesWeekKey || weekKey(),
    createdAt: raw.createdAt || base.createdAt,
  }
}

export const emptyHabitosState = (): HabitosState => ({
  dayKey: dateKey(),
  habits: [],
  dayLog: {},
})

export function renewFreezes(habit: Habit, today = new Date()): Habit {
  const wk = weekKey(today)
  if (habit.freezesWeekKey === wk) return habit
  return {
    ...habit,
    freezesWeekKey: wk,
    freezesLeft: HABIT_FREEZES_PER_WEEK,
  }
}
