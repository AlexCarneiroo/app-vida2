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
  /** true se adicionou/trocou/removeu exercícios nesta sessão */
  structureDirty?: boolean
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
  /** Minutos treinado (concluiu − iniciou), arredondados. */
  durationMin: number
  /** Ex.: "47 min" ou "1 h 12 min" */
  durationLabel: string
  /** Ex.: "14:02 → 15:14" */
  timeRange: string
  volume: number
  setsDone: number
  totalSets: number
  prs: PersonalRecord[]
  previousVolume: number | null
  volumeDelta: number | null
}

export type EffortLevel = 'light' | 'moderate' | 'hard'

export type TreinoSettings = {
  restSeconds: 60 | 90 | 120
  /** Se false, não mostra o contador após cada série */
  restTimerEnabled: boolean
  /**
   * Modo instrutor: após cada série pergunta esforço (leve/médio/pesado)
   * e ajusta a carga das séries seguintes.
   */
  instructorMode: boolean
  /**
   * Modo rápido: só pergunta esforço a cada 2 séries concluídas
   * (em vez de após cada uma).
   */
  instructorQuickMode: boolean
}

/** Resultado do ajuste do modo instrutor numa série. */
export type InstructorAdjust = {
  weight: number
  reps: number
  repsChanged: boolean
  lastWeight: number | null
}

/** Plano semanal criado/guardado pelo utilizador */
export type SavedCustomPlan = {
  id: string
  name: string
  tagline: string
  savedAt: string
  templates: WorkoutTemplate[]
}

export type TreinoState = {
  plan: WorkoutTemplate[]
  active: ActiveWorkout | null
  history: ActiveWorkout[]
  weekDone: Record<string, string> // dateKey -> templateId
  settings: TreinoSettings
  /** id do preset catalogado (null = personalizado / saved) */
  activePresetId: string | null
  /** id do plano guardado ativo, se aplicável */
  activeSavedPlanId: string | null
  /** planos semanais personalizados guardados */
  savedPlans: SavedCustomPlan[]
}

export type LoadSuggestion = {
  weight: number
  fromWeight: number
  label: string
}
