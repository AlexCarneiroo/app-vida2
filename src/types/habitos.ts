export type HabitCategory =
  | 'saude'
  | 'mente'
  | 'corpo'
  | 'produtividade'
  | 'social'
  | 'financeiro'
  | 'outro'

/** Com que frequência o hábito conta para a sequência */
export type HabitFrequency = 'daily' | 'weekdays' | 'weekends' | 'custom'

/** check = feito/não · count = meta numérica (ex.: 8 copos) */
export type HabitGoalKind = 'check' | 'count'

export type Habit = {
  id: string
  name: string
  detail: string
  category: HabitCategory
  frequency: HabitFrequency
  /** 0=dom … 6=sáb — só usado com frequency = custom */
  customDays: number[]
  goalKind: HabitGoalKind
  /** Para check fica 1; para count é o alvo do dia */
  goalTarget: number
  /** Progresso de hoje (count). Em check: 0 ou 1 */
  progressToday: number
  /** Hora preferida HH:MM ou null */
  preferredTime: string | null
  reminderEnabled: boolean
  reminderTime: string | null
  /** Meta de poupança (Finanças) associada — opcional */
  linkedGoalId: string | null
  /** Se > 0, ao concluir o hábito no dia soma este valor à meta */
  goalBoostAmount: number
  streak: number
  bestStreak: number
  doneToday: boolean
  /** Dia difícil: preserva a sequência sem concluir */
  skippedToday: boolean
  lastDoneDateKey: string | null
  lastSkipDateKey: string | null
  /** Congelamentos semanais restantes (proteção de streak) */
  freezesLeft: number
  /** Início da semana civil (dateKey) em que freezesLeft foi renovado */
  freezesWeekKey: string
  createdAt: string
}

export type HabitInput = {
  name: string
  detail?: string
  category?: HabitCategory
  frequency?: HabitFrequency
  customDays?: number[]
  goalKind?: HabitGoalKind
  goalTarget?: number
  preferredTime?: string | null
  reminderEnabled?: boolean
  reminderTime?: string | null
  linkedGoalId?: string | null
  goalBoostAmount?: number
}

export type HabitosState = {
  dayKey: string
  habits: Habit[]
  dayLog: Record<string, number>
}
