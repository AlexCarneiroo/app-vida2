import type {
  ActiveWorkout,
  Exercise,
  LoadSuggestion,
  PersonalRecord,
  WorkoutSummary,
} from '../types/treino'

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

export function buildWorkoutSummary(
  workout: ActiveWorkout,
  priorHistory: ActiveWorkout[],
): WorkoutSummary {
  const completedAt = workout.completedAt
    ? new Date(workout.completedAt).getTime()
    : Date.now()
  const startedAt = new Date(workout.startedAt).getTime()
  const durationMin = Math.max(
    1,
    Math.round((completedAt - startedAt) / 60000),
  )
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
    volume,
    setsDone,
    totalSets,
    prs,
    previousVolume,
    volumeDelta:
      previousVolume === null ? null : Math.round(volume - previousVolume),
  }
}
