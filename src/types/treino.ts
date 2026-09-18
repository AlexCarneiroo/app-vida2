export type MuscleGroup =
  | 'peito'
  | 'costas'
  | 'ombros'
  | 'bíceps'
  | 'tríceps'
  | 'pernas'
  | 'core'
  | 'cardio'
  | 'mobilidade'

export type WorkoutSet = {
  id: string
  reps: number
  weight: number
  done: boolean
}

export type Exercise = {
  id: string
  /** id estável do exercício no template (para cruzar histórico/cargas) */
  sourceId: string
  name: string
  muscle: MuscleGroup
  notes?: string
  sets: WorkoutSet[]
}

export type TemplateExercise = {
  id: string
  name: string
  muscle: MuscleGroup
  notes?: string
  sets: { reps: number; weight: number }[]
}

export type WorkoutTemplate = {
  id: string
  name: string
  focus: string
  estimatedMin: number
  dayOfWeek: number // 0=domingo
  exercises: TemplateExercise[]
}

export type ActiveWorkout = {
  dateKey: string
  templateId: string
  name: string
  focus: string
  startedAt: string
  completedAt?: string
  exercises: Exercise[]
}

export type ExerciseSessionLog = {
  dateKey: string
  workoutName: string
  maxWeight: number
  bestSet: string
  volume: number
  setsDone: number
}

export type ExerciseProgress = {
  key: string
  name: string
  muscle: MuscleGroup
  sessions: ExerciseSessionLog[]
  lastWeight: number
  bestWeight: number
  delta: number
}

export type PersonalRecord = {
  exerciseName: string
  muscle: MuscleGroup
  weight: number
  previousBest: number
  bestSet: string
}

export type WorkoutSummary = {
  name: string
  dateKey: string
  durationMin: number
  volume: number
  setsDone: number
  totalSets: number
  prs: PersonalRecord[]
  previousVolume: number | null
  volumeDelta: number | null
}

export type TreinoSettings = {
  restSeconds: 60 | 90 | 120
}

export type TreinoState = {
  plan: WorkoutTemplate[]
  active: ActiveWorkout | null
  history: ActiveWorkout[]
  weekDone: Record<string, string> // dateKey -> templateId
  settings: TreinoSettings
  /** id do preset aplicado (null = plano personalizado) */
  activePresetId: string | null
}

export type LoadSuggestion = {
  weight: number
  fromWeight: number
  label: string
}
