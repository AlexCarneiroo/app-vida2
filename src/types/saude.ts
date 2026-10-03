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

export type SleepEntry = {
  id: string
  dateKey: string
  hours: number
  quality: SleepQuality
  /** HH:mm */
  bedTime?: string | null
  /** HH:mm */
  wakeTime?: string | null
  note?: string
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
  weeklyGoals: WeeklyHealthGoals
  metrics: BodyMetric[]
  sleep: SleepEntry[]
  exams: LabExam[]
  checkIns: HealthCheckIn[]
  medications: Medication[]
  photos: ProgressPhoto[]
  lastConsult: QuickConsult | null
  proNotes: ProNote[]
}
