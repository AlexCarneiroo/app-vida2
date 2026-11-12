export type BodySex = 'm' | 'f' | 'outro'

export type BodyMetric = {
  id: string
  dateKey: string
  weightKg: number
  waistCm?: number
  armCm?: number
  bodyFatPct?: number
  leanMassKg?: number
  note?: string
  createdAt: string
}

export type SleepQuality = 1 | 2 | 3 | 4 | 5

/** Hábitos da noite que influenciam o descanso (declarados pelo utilizador). */
export type SleepHabitFlags = {
  phoneBeforeBed: boolean
  caffeineLate: boolean
  exerciseLate: boolean
  alcohol: boolean
  heavyMeal: boolean
}

export type SleepEntry = {
  id: string
  dateKey: string
  hours: number
  quality: SleepQuality
  /** Disposição ao acordar (1–5) */
  readiness?: SleepQuality
  /** HH:mm */
  bedTime?: string | null
  /** HH:mm */
  wakeTime?: string | null
  /** Minutos até adormecer */
  latencyMin?: number
  /** Despertares noturnos */
  awakenings?: number
  habits?: Partial<SleepHabitFlags>
  note?: string
}

export type NapEntry = {
  id: string
  dateKey: string
  /** HH:mm */
  startTime: string
  /** HH:mm */
  endTime: string
  minutes: number
  note?: string
  createdAt: string
}

export type SleepRoutineItem = {
  id: string
  label: string
  enabled: boolean
  order: number
}

export type SleepChallengeKind = 7 | 14 | 30

export type SleepChallenge = {
  id: string
  kind: SleepChallengeKind
  startDateKey: string
  active: boolean
  completedDateKey?: string | null
}

export type LabExam = {
  id: string
  dateKey: string
  name: string
  value: string
  unit?: string
  refRange?: string
  note?: string
  /** Relembrar refazer */
  nextDueDateKey?: string | null
  attachmentName?: string
  /** data URL comprimida (opcional) */
  attachmentDataUrl?: string
  createdAt: string
}

export type HealthCheckIn = {
  id: string
  dateKey: string
  energy: SleepQuality
  mood: SleepQuality
  symptoms?: string
}

export type Medication = {
  id: string
  name: string
  dose: string
  /** HH:mm */
  time: string
  enabled: boolean
  lastTakenDateKey?: string | null
}

export type ProgressPhoto = {
  id: string
  dateKey: string
  /** JPEG data URL comprimida */
  dataUrl: string
  note?: string
  createdAt: string
}

export type WeeklyHealthGoals = {
  /** Dias com meta de água atingida */
  waterDaysTarget: number
  /** Dias com sono 7–9h */
  sleepDaysTarget: number
}

export type QuickConsult = {
  dateKey: string
  q1: string
  q2: string
  q3: string
  plan: string[]
}

export type ProNote = {
  id: string
  author: string
  body: string
  createdAt: string
}

export type SaudeState = {
  heightCm: number
  sex: BodySex | null
  weightGoalKg: number
  sleepReminderEnabled: boolean
  sleepReminderTime: string
  /** Meta diária de horas (ex.: 8) */
  sleepGoalHours: number
  sleepGoalBedTime: string
  sleepGoalWakeTime: string
  windDownEnabled: boolean
  /** Minutos antes da hora de deitar */
  windDownMinutes: number
  weeklyGoals: WeeklyHealthGoals
  metrics: BodyMetric[]
  sleep: SleepEntry[]
  naps: NapEntry[]
  sleepRoutine: SleepRoutineItem[]
  /** dateKey → ids de itens concluídos na rotina */
  sleepRoutineDone: Record<string, string[]>
  sleepChallenge: SleepChallenge | null
  exams: LabExam[]
  checkIns: HealthCheckIn[]
  medications: Medication[]
  photos: ProgressPhoto[]
  lastConsult: QuickConsult | null
  proNotes: ProNote[]
}
