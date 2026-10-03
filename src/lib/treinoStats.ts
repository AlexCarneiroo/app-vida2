import type {
  ActiveWorkout,
  EffortLevel,
  Exercise,
  InstructorAdjust,
  LoadSuggestion,
  PersonalRecord,
  WorkoutSummary,
} from '../types/treino'

const LOAD_STEP = 2.5

export function roundLoad(n: number) {
  return Math.max(0, Math.round(n * 2) / 2)
}

/** Ajusta carga/reps conforme esforço (modo instrutor). */
export function applyEffortToSetTargets(
  weight: number,
  reps: number,
  effort: EffortLevel,
  lastSetReps?: number,
): { weight: number; reps: number; repsChanged: boolean } {
  const target = Math.max(1, reps)

  if (effort === 'light') {
    // Peso corporal / sem carga: sobe reps
    if (weight <= 0) {
      const nextReps = target + 2
      return { weight: 0, reps: nextReps, repsChanged: nextReps !== target }
    }
    const nextWeight = roundLoad(weight + LOAD_STEP)
    // Se esmagou as reps alvo, também sobe 1 rep nas próximas
    const crushed =
      typeof lastSetReps === 'number' && lastSetReps >= target + 2
    const nextReps = crushed ? target + 1 : target
    return {
      weight: nextWeight,
      reps: nextReps,
      repsChanged: nextReps !== target,
    }
  }

  if (effort === 'hard') {
    if (weight >= LOAD_STEP) {
      return {
        weight: roundLoad(weight - LOAD_STEP),
        reps: target,
        repsChanged: false,
      }
    }
    const nextReps = Math.max(1, target - 1)
    return {
      weight: roundLoad(weight),
      reps: nextReps,
      repsChanged: nextReps !== target,
    }
  }

  return { weight: roundLoad(weight), reps: target, repsChanged: false }
}

export function lastSessionMaxWeight(
  history: ActiveWorkout[],
  sourceId: string,
  name: string,
  skipStartedAt?: string,
): number | null {
  const last = findLastExercise(history, sourceId, name, skipStartedAt)
  if (!last) return null
  const done = last.sets.filter((s) => s.done && s.weight > 0)
  if (done.length === 0) {
    const any = last.sets.filter((s) => s.done)
    if (any.length === 0) return null
    return Math.max(...any.map((s) => s.weight))
  }
  return Math.max(...done.map((s) => s.weight))
}

export function instructorTip(
  effort: EffortLevel,
  adjust: Pick<InstructorAdjust, 'weight' | 'reps' | 'repsChanged' | 'lastWeight'>,
): string {
  const lastBit =
    adjust.lastWeight != null && adjust.lastWeight > 0
      ? ` (última vez ${adjust.lastWeight} kg)`
      : ''

  if (effort === 'light') {
    if (adjust.weight <= 0 && adjust.repsChanged) {
      return `Leve — próximas a ${adjust.reps} reps${lastBit}.`
    }
    if (adjust.repsChanged) {
      return `Leve — ${adjust.weight} kg × ${adjust.reps} reps${lastBit}.`
    }
    return `Leve — próximas séries a ${adjust.weight} kg${lastBit}.`
  }
  if (effort === 'hard') {
    if (adjust.repsChanged) {
      return `Pesado — baixamos para ${adjust.reps} reps. Técnica primeiro.`
    }
    return adjust.weight > 0
      ? `Pesado — baixamos para ${adjust.weight} kg. Técnica primeiro.`
      : 'Pesado — descansa bem e foca na execução.'
  }
  return lastBit
    ? `Médio — carga mantida${lastBit}. Continua assim.`
    : 'Médio — carga mantida. Continua assim.'
}

/** Deve o instrutor perguntar após esta série concluída? */
export function shouldAskInstructor(
  doneCountAfter: number,
  remaining: number,
  quickMode: boolean,
): boolean {
  if (remaining <= 0) return false
  if (!quickMode) return true
  // Modo rápido: pergunta na 2ª, 4ª… série concluída
  return doneCountAfter % 2 === 0
}

export function normalizeExerciseName(name: string) {
  return name.trim().toLowerCase()
}

export function workoutVolume(workout: ActiveWorkout) {
  return workout.exercises.reduce(
    (acc, ex) =>
      acc +
      ex.sets
        .filter((s) => s.done)
        .reduce((a, s) => a + s.reps * s.weight, 0),
    0,
  )
}

export function workoutSetsDone(workout: ActiveWorkout) {
  return workout.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.done).length,
    0,
  )
}

export function findLastExercise(
  history: ActiveWorkout[],
  sourceId: string,
  name: string,
  skipStartedAt?: string,
): Exercise | null {
  const key = normalizeExerciseName(name)
  for (const workout of history) {
    if (skipStartedAt && workout.startedAt === skipStartedAt) continue
    const match =
      workout.exercises.find((ex) => ex.sourceId === sourceId) ??
      workout.exercises.find((ex) => normalizeExerciseName(ex.name) === key)
    if (!match) continue
    if (match.sets.some((s) => s.done)) return match
  }
  return null
}

/** Se a última sessão bateu as reps alvo em todas as séries, sugere +2,5 kg. */
export function getLoadSuggestion(
  exercise: Exercise,
  history: ActiveWorkout[],
): LoadSuggestion | null {
  const last = findLastExercise(history, exercise.sourceId, exercise.name)
  if (!last) return null

  const done = last.sets.filter((s) => s.done)
  if (done.length === 0) return null

  const targetReps =
    exercise.sets[0]?.reps ||
    Math.round(done.reduce((a, s) => a + s.reps, 0) / done.length)

  const hitAllReps = done.every((s) => s.reps >= targetReps)
  const lastMax = Math.max(...done.map((s) => s.weight))
  if (!hitAllReps || lastMax <= 0) return null

  const next = Math.round((lastMax + 2.5) * 2) / 2
  const current = exercise.sets.find((s) => !s.done)?.weight ?? lastMax
  if (current >= next) return null

  return {
    weight: next,
    fromWeight: lastMax,
    label: `Bateu as reps — tentar ${next} kg`,
  }
}

export function findPersonalRecords(
  workout: ActiveWorkout,
  priorHistory: ActiveWorkout[],
): PersonalRecord[] {
  const prs: PersonalRecord[] = []

  for (const ex of workout.exercises) {
    const done = ex.sets.filter((s) => s.done && s.weight > 0)
    if (done.length === 0) continue

    const maxWeight = Math.max(...done.map((s) => s.weight))
    const best = done.reduce((a, b) =>
      a.weight > b.weight || (a.weight === b.weight && a.reps >= b.reps) ? a : b,
    )

    let previousBest = 0
    for (const past of priorHistory) {
      for (const pastEx of past.exercises) {
        const same =
          pastEx.sourceId === ex.sourceId ||
          normalizeExerciseName(pastEx.name) === normalizeExerciseName(ex.name)
        if (!same) continue
        for (const s of pastEx.sets) {
          if (s.done && s.weight > previousBest) previousBest = s.weight
        }
      }
    }

    if (maxWeight > previousBest) {
      prs.push({
        exerciseName: ex.name,
        muscle: ex.muscle,
        weight: maxWeight,
        previousBest,
        bestSet: `${best.reps}×${best.weight}kg`,
      })
    }
  }

  return prs
}

function formatClock(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/** Minutos entre início e fim da sessão (só relógio real). */
export function workoutDurationMinutes(
  startedAt: string,
  completedAt?: string,
): number {
  const start = new Date(startedAt).getTime()
  const end = new Date(completedAt || Date.now()).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0
  return Math.max(0, Math.round((end - start) / 60000))
}

export function formatWorkoutDurationLabel(minutes: number) {
  if (minutes <= 0) return '< 1 min'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

export function buildWorkoutSummary(
  workout: ActiveWorkout,
  priorHistory: ActiveWorkout[],
): WorkoutSummary {
  const completedIso = workout.completedAt || new Date().toISOString()
  const durationMin = workoutDurationMinutes(workout.startedAt, completedIso)
  const volume = workoutVolume(workout)
  const setsDone = workoutSetsDone(workout)
  const totalSets = workout.exercises.reduce(
    (acc, ex) => acc + ex.sets.length,
    0,
  )
  const prs = findPersonalRecords(workout, priorHistory)

  const previousSame = priorHistory.find(
    (w) => w.templateId === workout.templateId,
  )
  const previousVolume = previousSame ? workoutVolume(previousSame) : null

  return {
    name: workout.name,
    dateKey: workout.dateKey,
    durationMin,
    durationLabel: formatWorkoutDurationLabel(durationMin),
    timeRange: `${formatClock(workout.startedAt)} → ${formatClock(completedIso)}`,
    volume,
    setsDone,
    totalSets,
    prs,
    previousVolume,
    volumeDelta:
      previousVolume === null ? null : Math.round(volume - previousVolume),
  }
}
