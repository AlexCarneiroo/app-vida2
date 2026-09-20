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

/** Meta pessoal de longo prazo (ex.: beber 2 L de água / dia via hábito) */
export type PersonalGoal = {
  id: string
  name: string
  detail: string
  category: HabitCategory
  /** Alvo total (ex.: 60 litros no mês, 12 livros, 2 L) */
  target: number
  /** Unidade livre: L, ml, min, páginas, km, vezes… */
  unit: string
  /** Progresso acumulado */
  current: number
  /** Quanto contribui cada conclusão do hábito ligado (se o hábito não definir override) */
  defaultBoost: number
  createdAt: string
  completedAt: string | null
}

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
  /** Meta pessoal associada */
  linkedPersonalGoalId: string | null
  /** Quanto somar à meta pessoal ao concluir (0 = usa defaultBoost da meta) */
  personalBoost: number
  /** Meta de poupança (Finanças) associada — opcional */
  linkedGoalId: string | null
  /** Se > 0, ao concluir o hábito no dia soma este valor à meta financeira */
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
  linkedPersonalGoalId?: string | null
  personalBoost?: number
  linkedGoalId?: string | null
  goalBoostAmount?: number
}

export type PersonalGoalInput = {
  name: string
  detail?: string
  category?: HabitCategory
  target: number
  unit?: string
  defaultBoost?: number
}

export type HabitosState = {
  dayKey: string
  habits: Habit[]
  dayLog: Record<string, number>
  personalGoals: PersonalGoal[]
}
