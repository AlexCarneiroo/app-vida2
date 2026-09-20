import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { defaultExerciseName } from '../data/exerciseLibrary'
import {
  buildWorkoutTemplate,
  type WorkoutStarterId,
} from '../data/workoutStarters'
import {
  clonePresetPlan,
  getPresetById,
} from '../data/planPresets'
import { WEEKLY_PLAN, clonePlan } from '../data/treinoDefaults'
import {
  flushCloudSave,
  hydrateFromCloud,
  scheduleCloudSave,
} from '../lib/cloudSync'
import { dateKey, uid as makeId } from '../lib/date'
import { loadTreinoPersisted, touchPersisted } from '../lib/persist'
import {
  buildWorkoutSummary,
  findLastExercise,
  getLoadSuggestion,
  normalizeExerciseName,
  workoutSetsDone,
  workoutVolume,
} from '../lib/treinoStats'
import { useAuth } from './useAuth'
import type {
  ActiveWorkout,
  Exercise,
  ExerciseProgress,
  LoadSuggestion,
  MuscleGroup,
  SavedCustomPlan,
  TemplateExercise,
  TreinoSettings,
  TreinoState,
  WorkoutSummary,
  WorkoutTemplate,
} from '../types/treino'

const STORAGE_KEY = 'vida.treino.v1'

const defaultSettings: TreinoSettings = {
  restSeconds: 90,
  restTimerEnabled: true,
}


const emptyState: TreinoState = {
  plan: [],
  active: null,
  history: [],
  weekDone: {},
  settings: defaultSettings,
  activePresetId: null,
  activeSavedPlanId: null,
  savedPlans: [],
}

function loadState(): TreinoState {
  return loadTreinoPersisted(STORAGE_KEY, emptyState).data
}

function loadTreinoDoc() {
  return loadTreinoPersisted(STORAGE_KEY, emptyState)
}

function templateToExercises(
  template: WorkoutTemplate,
  history: ActiveWorkout[],
): Exercise[] {
  return template.exercises.map((ex) => {
    const last = findLastExercise(history, ex.id, ex.name)
    const baseSets =
      last && last.sets.some((s) => s.done)
        ? ex.sets.map((s, i) => {
            const prev = last.sets[i] ?? last.sets[last.sets.length - 1]
            return {
              reps: prev?.reps ?? s.reps,
              weight: prev?.weight ?? s.weight,
            }
          })
        : ex.sets

    return {
      id: makeId(ex.id),
      sourceId: ex.id,
      name: ex.name,
      muscle: ex.muscle,
      notes: ex.notes,
      sets: baseSets.map((s) => ({
        id: makeId('set'),
        reps: s.reps,
        weight: s.weight,
        done: false,
      })),
    }
  })
}

function syncPlanFromWorkout(
  plan: WorkoutTemplate[],
  workout: ActiveWorkout,
): WorkoutTemplate[] {
  return plan.map((template) => {
    if (template.id !== workout.templateId) return template
    return {
      ...template,
      exercises: template.exercises.map((te) => {
        const activeEx =
          workout.exercises.find((e) => e.sourceId === te.id) ??
          workout.exercises.find(
            (e) =>
              normalizeExerciseName(e.name) === normalizeExerciseName(te.name),
          )
        if (!activeEx) return te
        const doneSets = activeEx.sets.filter((s) => s.done)
        if (doneSets.length === 0) return te

        const nextSets =
          te.sets.length > 0
            ? te.sets.map((s, i) => ({
                reps: doneSets[Math.min(i, doneSets.length - 1)]?.reps ?? s.reps,
                weight:
                  doneSets[Math.min(i, doneSets.length - 1)]?.weight ?? s.weight,
              }))
            : doneSets.map((s) => ({ reps: s.reps, weight: s.weight }))

        return { ...te, sets: nextSets }
      }),
    }
  })
}

function buildProgression(history: ActiveWorkout[]): ExerciseProgress[] {
  type Acc = {
    name: string
    muscle: MuscleGroup
    sessions: ExerciseProgress['sessions']
  }
  const map = new Map<string, Acc>()

  for (const workout of [...history].reverse()) {
    for (const ex of workout.exercises) {
      const done = ex.sets.filter((s) => s.done)
      if (done.length === 0) continue

      const key = ex.sourceId || normalizeExerciseName(ex.name)
      const maxWeight = Math.max(...done.map((s) => s.weight))
      const best = done.reduce((a, b) =>
        a.weight * a.reps >= b.weight * b.reps ? a : b,
      )
      const volume = done.reduce((acc, s) => acc + s.reps * s.weight, 0)
      const entry = map.get(key) ?? {
        name: ex.name,
        muscle: ex.muscle,
        sessions: [],
      }
      entry.name = ex.name
      entry.muscle = ex.muscle
      entry.sessions.push({
        dateKey: workout.dateKey,
        workoutName: workout.name,
        maxWeight,
        bestSet: `${best.reps}×${best.weight}kg`,
        volume,
        setsDone: done.length,
      })
      map.set(key, entry)
    }
  }

  return [...map.entries()]
    .map(([key, value]) => {
      const sessions = value.sessions
      const lastWeight = sessions.at(-1)?.maxWeight ?? 0
      const prevWeight = sessions.at(-2)?.maxWeight ?? lastWeight
      const bestWeight = sessions.reduce(
        (max, s) => Math.max(max, s.maxWeight),
        0,
      )
      return {
        key,
        name: value.name,
        muscle: value.muscle,
        sessions: [...sessions].reverse(),
        lastWeight,
        bestWeight,
        delta: lastWeight - prevWeight,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
}

function blankExercise(): TemplateExercise {
  return {
    id: makeId('ex'),
    name: defaultExerciseName('peito'),
    muscle: 'peito',
    sets: [
      { reps: 10, weight: 20 },
      { reps: 10, weight: 20 },
      { reps: 10, weight: 20 },
    ],
  }
}

export function useTreino() {
  const { uid, ready: authReady } = useAuth()
  const [state, setState] = useState<TreinoState>(() =>
    typeof window === 'undefined' ? emptyState : loadState(),
  )
  const [lastSummary, setLastSummary] = useState<WorkoutSummary | null>(null)
  const hydratedRef = useRef(false)
  const stateRef = useRef(state)
  const updatedAtRef = useRef(loadTreinoDoc().updatedAt)
  stateRef.current = state

  useEffect(() => {
    if (!authReady) return
    let cancelled = false
    hydratedRef.current = false
    ;(async () => {
      const localAtStart = loadTreinoDoc()
      const next = await hydrateFromCloud(
        'treino',
        localAtStart,
        (d) => d.history.length === 0 && !d.active && d.plan.length === 0,
      )
      if (cancelled) return
      const latestLocal = loadTreinoDoc()
      let finalDoc = next
      if (
        latestLocal.updatedAt > localAtStart.updatedAt &&
        latestLocal.updatedAt >= next.updatedAt
      ) {
        finalDoc = await hydrateFromCloud(
          'treino',
          latestLocal,
          (d) => d.history.length === 0 && !d.active && d.plan.length === 0,
        )
      }
      if (cancelled) return
      setState(finalDoc.data)
      updatedAtRef.current = finalDoc.updatedAt
      touchPersisted(STORAGE_KEY, finalDoc.data, finalDoc.updatedAt)
      hydratedRef.current = true
    })()
    return () => {
      cancelled = true
    }
  }, [uid, authReady])

  useEffect(() => {
    const at = Date.now()
    updatedAtRef.current = at
    touchPersisted(STORAGE_KEY, state, at)
    if (hydratedRef.current) scheduleCloudSave('treino', state, at)
  }, [state])

  useEffect(() => {
    const flush = () => {
      const at = updatedAtRef.current || Date.now()
      touchPersisted(STORAGE_KEY, stateRef.current, at)
      if (!hydratedRef.current) return
      void flushCloudSave('treino', stateRef.current, at)
    }
    const onOnline = () => {
      window.setTimeout(flush, 400)
    }
    window.addEventListener('pagehide', flush)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  const todayKey = dateKey()
  const todayDow = new Date().getDay()
  const plan = state.plan

  const todayTemplate = useMemo(
    () => plan.find((t) => t.dayOfWeek === todayDow) ?? null,
    [plan, todayDow],
  )

  const progression = useMemo(
    () => buildProgression(state.history),
    [state.history],
  )

  const isTodayDone = Boolean(state.weekDone[todayKey])

  const startWorkout = useCallback((template: WorkoutTemplate) => {
    setLastSummary(null)
    setState((prev) => ({
      ...prev,
      active: {
        dateKey: dateKey(),
        templateId: template.id,
        name: template.name,
        focus: template.focus,
        startedAt: new Date().toISOString(),
        exercises: templateToExercises(template, prev.history),
      },
    }))
  }, [])

  const discardWorkout = useCallback(() => {
    setState((prev) => ({ ...prev, active: null }))
  }, [])

  const toggleSet = useCallback((exerciseId: string, setId: string) => {
    setState((prev) => {
      if (!prev.active) return prev
      return {
        ...prev,
        active: {
          ...prev.active,
          exercises: prev.active.exercises.map((ex) =>
            ex.id !== exerciseId
              ? ex
              : {
                  ...ex,
                  sets: ex.sets.map((s) =>
                    s.id === setId ? { ...s, done: !s.done } : s,
                  ),
                },
          ),
        },
      }
    })
  }, [])

  const updateSet = useCallback(
    (
      exerciseId: string,
      setId: string,
      patch: Partial<{ reps: number; weight: number }>,
    ) => {
      setState((prev) => {
        if (!prev.active) return prev
        return {
          ...prev,
          active: {
            ...prev.active,
            exercises: prev.active.exercises.map((ex) =>
              ex.id !== exerciseId
                ? ex
                : {
                    ...ex,
                    sets: ex.sets.map((s) =>
                      s.id === setId ? { ...s, ...patch } : s,
                    ),
                  },
            ),
          },
        }
      })
    },
    [],
  )

  const addActiveSet = useCallback((exerciseId: string) => {
    setState((prev) => {
      if (!prev.active) return prev
      return {
        ...prev,
        active: {
          ...prev.active,
          exercises: prev.active.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex
            const last = ex.sets[ex.sets.length - 1]
            return {
              ...ex,
              sets: [
                ...ex.sets,
                {
                  id: makeId('set'),
                  reps: last?.reps ?? 10,
                  weight: last?.weight ?? 20,
                  done: false,
                },
              ],
            }
          }),
        },
      }
    })
  }, [])

  const removeActiveSet = useCallback((exerciseId: string, setId: string) => {
    setState((prev) => {
      if (!prev.active) return prev
      return {
        ...prev,
        active: {
          ...prev.active,
          exercises: prev.active.exercises.map((ex) => {
            if (ex.id !== exerciseId || ex.sets.length <= 1) return ex
            return {
              ...ex,
              sets: ex.sets.filter((s) => s.id !== setId),
            }
          }),
        },
      }
    })
  }, [])

  const applyWeightBump = useCallback((exerciseId: string, delta = 2.5) => {
    setState((prev) => {
      if (!prev.active) return prev
      return {
        ...prev,
        active: {
          ...prev.active,
          exercises: prev.active.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex
            return {
              ...ex,
              sets: ex.sets.map((s) =>
                s.done
                  ? s
                  : {
                      ...s,
                      weight: Math.round((s.weight + delta) * 2) / 2,
                    },
              ),
            }
          }),
        },
      }
    })
  }, [])

  const applySuggestedWeight = useCallback(
    (exerciseId: string, weight: number) => {
      setState((prev) => {
        if (!prev.active) return prev
        return {
          ...prev,
          active: {
            ...prev.active,
            exercises: prev.active.exercises.map((ex) => {
              if (ex.id !== exerciseId) return ex
              return {
                ...ex,
                sets: ex.sets.map((s) =>
                  s.done ? s : { ...s, weight },
                ),
              }
            }),
          },
        }
      })
    },
    [],
  )

  const suggestionFor = useCallback(
    (exercise: Exercise): LoadSuggestion | null =>
      getLoadSuggestion(exercise, state.history),
    [state.history],
  )

  const completeWorkout = useCallback(() => {
    setState((prev) => {
      if (!prev.active) return prev
      const finished: ActiveWorkout = {
        ...prev.active,
        completedAt: new Date().toISOString(),
      }
      const summary = buildWorkoutSummary(finished, prev.history)
      queueMicrotask(() => setLastSummary(summary))
      return {
        ...prev,
        active: null,
        history: [finished, ...prev.history].slice(0, 80),
        weekDone: {
          ...prev.weekDone,
          [finished.dateKey]: finished.templateId,
        },
        plan: syncPlanFromWorkout(prev.plan, finished),
      }
    })
  }, [])

  const clearSummary = useCallback(() => setLastSummary(null), [])

  const setRestSeconds = useCallback((restSeconds: TreinoSettings['restSeconds']) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, restSeconds },
    }))
  }, [])

  const setRestTimerEnabled = useCallback((restTimerEnabled: boolean) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, restTimerEnabled },
    }))
  }, [])

  const updateTemplate = useCallback(
    (
      templateId: string,
      patch: Partial<Omit<WorkoutTemplate, 'id' | 'exercises'>>,
    ) => {
      setState((prev) => ({
        ...prev,
        activePresetId: null,
        activeSavedPlanId: null,
        plan: prev.plan.map((t) =>
          t.id === templateId ? { ...t, ...patch } : t,
        ),
      }))
    },
    [],
  )

  const addTemplate = useCallback(
    (dayOfWeek = 1, starter: WorkoutStarterId = 'custom') => {
      setState((prev) => {
        if (prev.plan.some((t) => t.dayOfWeek === dayOfWeek)) return prev
        return {
          ...prev,
          activePresetId: null,
          activeSavedPlanId: null,
          plan: [...prev.plan, buildWorkoutTemplate(dayOfWeek, starter)],
        }
      })
    },
    [],
  )

  const startBlankCustomPlan = useCallback(() => {
    setState((prev) => ({
      ...prev,
      plan: [],
      activePresetId: null,
      activeSavedPlanId: null,
      active: null,
    }))
  }, [])

  const removeTemplate = useCallback((templateId: string) => {
    setState((prev) => ({
      ...prev,
      activePresetId: null,
        activeSavedPlanId: null,
      plan: prev.plan.filter((t) => t.id !== templateId),
    }))
  }, [])

  const addExercise = useCallback((templateId: string) => {
    setState((prev) => ({
      ...prev,
      activePresetId: null,
        activeSavedPlanId: null,
      plan: prev.plan.map((t) =>
        t.id === templateId
          ? { ...t, exercises: [...t.exercises, blankExercise()] }
          : t,
      ),
    }))
  }, [])

  const updateExercise = useCallback(
    (
      templateId: string,
      exerciseId: string,
      patch: Partial<Omit<TemplateExercise, 'id'>>,
    ) => {
      setState((prev) => ({
        ...prev,
        activePresetId: null,
        activeSavedPlanId: null,
        plan: prev.plan.map((t) =>
          t.id !== templateId
            ? t
            : {
                ...t,
                exercises: t.exercises.map((ex) =>
                  ex.id === exerciseId ? { ...ex, ...patch } : ex,
                ),
              },
        ),
      }))
    },
    [],
  )

  const removeExercise = useCallback((templateId: string, exerciseId: string) => {
    setState((prev) => ({
      ...prev,
      activePresetId: null,
        activeSavedPlanId: null,
      plan: prev.plan.map((t) =>
        t.id !== templateId
          ? t
          : {
              ...t,
              exercises: t.exercises.filter((ex) => ex.id !== exerciseId),
            },
      ),
    }))
  }, [])

  const addTemplateSet = useCallback((templateId: string, exerciseId: string) => {
    setState((prev) => ({
      ...prev,
      activePresetId: null,
        activeSavedPlanId: null,
      plan: prev.plan.map((t) =>
        t.id !== templateId
          ? t
          : {
              ...t,
              exercises: t.exercises.map((ex) => {
                if (ex.id !== exerciseId) return ex
                const last = ex.sets[ex.sets.length - 1] ?? {
                  reps: 10,
                  weight: 20,
                }
                return { ...ex, sets: [...ex.sets, { ...last }] }
              }),
            },
      ),
    }))
  }, [])

  const removeTemplateSet = useCallback(
    (templateId: string, exerciseId: string, setIndex: number) => {
      setState((prev) => ({
        ...prev,
        activePresetId: null,
        activeSavedPlanId: null,
        plan: prev.plan.map((t) =>
          t.id !== templateId
            ? t
            : {
                ...t,
                exercises: t.exercises.map((ex) => {
                  if (ex.id !== exerciseId) return ex
                  if (ex.sets.length <= 1) return ex
                  return {
                    ...ex,
                    sets: ex.sets.filter((_, i) => i !== setIndex),
                  }
                }),
              },
        ),
      }))
    },
    [],
  )

  const updateTemplateSet = useCallback(
    (
      templateId: string,
      exerciseId: string,
      setIndex: number,
      patch: Partial<{ reps: number; weight: number }>,
    ) => {
      setState((prev) => ({
        ...prev,
        activePresetId: null,
        activeSavedPlanId: null,
        plan: prev.plan.map((t) =>
          t.id !== templateId
            ? t
            : {
                ...t,
                exercises: t.exercises.map((ex) => {
                  if (ex.id !== exerciseId) return ex
                  return {
                    ...ex,
                    sets: ex.sets.map((s, i) =>
                      i === setIndex ? { ...s, ...patch } : s,
                    ),
                  }
                }),
              },
        ),
      }))
    },
    [],
  )

  const resetPlan = useCallback(() => {
    setState((prev) => ({
      ...prev,
      plan: clonePlan(WEEKLY_PLAN),
      activePresetId: 'ppl-classic',
      activeSavedPlanId: null,
    }))
  }, [])

  const restorePlanEdit = useCallback(
    (snapshot: {
      plan: WorkoutTemplate[]
      activePresetId: string | null
      activeSavedPlanId: string | null
    }) => {
      setState((prev) => ({
        ...prev,
        plan: clonePlan(snapshot.plan),
        activePresetId: snapshot.activePresetId,
        activeSavedPlanId: snapshot.activeSavedPlanId,
      }))
    },
    [],
  )

  const applyPreset = useCallback((presetId: string) => {
    const preset = getPresetById(presetId)
    if (!preset) return
    setState((prev) => ({
      ...prev,
      plan: clonePresetPlan(preset),
      activePresetId: preset.id,
        activeSavedPlanId: null,
      active: null,
    }))
  }, [])

  const saveCurrentPlan = useCallback((name: string, tagline = '') => {
    const trimmed = name.trim()
    if (!trimmed) return null
    const id = makeId('saved')
    let createdId: string | null = id
    setState((prev) => {
      if (prev.plan.length === 0) {
        createdId = null
        return prev
      }
      const entry: SavedCustomPlan = {
        id,
        name: trimmed,
        tagline: tagline.trim() || `${prev.plan.length} dias · personalizado`,
        savedAt: new Date().toISOString(),
        templates: clonePlan(prev.plan),
      }
      return {
        ...prev,
        activePresetId: null,
        activeSavedPlanId: id,
        savedPlans: [entry, ...(prev.savedPlans ?? [])],
      }
    })
    return createdId
  }, [])

  const applySavedPlan = useCallback((planId: string) => {
    setState((prev) => {
      const found = (prev.savedPlans ?? []).find((p) => p.id === planId)
      if (!found) return prev
      return {
        ...prev,
        plan: clonePlan(found.templates),
        activePresetId: null,
        activeSavedPlanId: found.id,
        active: null,
      }
    })
  }, [])

  const removeSavedPlan = useCallback((planId: string) => {
    setState((prev) => ({
      ...prev,
      activeSavedPlanId:
        prev.activeSavedPlanId === planId ? null : prev.activeSavedPlanId,
      savedPlans: (prev.savedPlans ?? []).filter((p) => p.id !== planId),
    }))
  }, [])

  const renameSavedPlan = useCallback((planId: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setState((prev) => ({
      ...prev,
      savedPlans: (prev.savedPlans ?? []).map((p) =>
        p.id === planId ? { ...p, name: trimmed } : p,
      ),
    }))
  }, [])

  const updateSavedPlanFromCurrent = useCallback((planId: string) => {
    setState((prev) => {
      if (prev.plan.length === 0) return prev
      return {
        ...prev,
        activePresetId: null,
        activeSavedPlanId: planId,
        savedPlans: (prev.savedPlans ?? []).map((p) =>
          p.id === planId
            ? {
                ...p,
                templates: clonePlan(prev.plan),
                savedAt: new Date().toISOString(),
              }
            : p,
        ),
      }
    })
  }, [])

  const stats = useMemo(() => {
    const active = state.active
    const totalSets =
      active?.exercises.reduce((acc, ex) => acc + ex.sets.length, 0) ?? 0
    const doneSets = active ? workoutSetsDone(active) : 0
    const volume = active ? workoutVolume(active) : 0
    const progress = totalSets === 0 ? 0 : Math.round((doneSets / totalSets) * 100)

    const weekSessions = Object.keys(state.weekDone).filter((k) => {
      const d = new Date(k + 'T12:00:00')
      const now = new Date()
      const start = new Date(now)
      start.setDate(now.getDate() - now.getDay())
      start.setHours(0, 0, 0, 0)
      return d >= start && d <= now
    }).length

    const homeProgress = isTodayDone
      ? 100
      : active
        ? progress
        : todayTemplate
          ? 0
          : 100

    return {
      totalSets,
      doneSets,
      volume,
      progress,
      weekSessions,
      homeProgress,
    }
  }, [state, isTodayDone, todayTemplate])

  return {
    state,
    todayKey,
    todayTemplate,
    isTodayDone,
    plan,
    progression,
    lastSummary,
    clearSummary,
    startWorkout,
    discardWorkout,
    toggleSet,
    updateSet,
    addActiveSet,
    removeActiveSet,
    applyWeightBump,
    applySuggestedWeight,
    suggestionFor,
    completeWorkout,
    setRestSeconds,
    setRestTimerEnabled,
    updateTemplate,
    addTemplate,
    startBlankCustomPlan,
    removeTemplate,
    addExercise,
    updateExercise,
    removeExercise,
    addTemplateSet,
    removeTemplateSet,
    updateTemplateSet,
    resetPlan,
    restorePlanEdit,
    applyPreset,
    saveCurrentPlan,
    applySavedPlan,
    removeSavedPlan,
    renameSavedPlan,
    updateSavedPlanFromCurrent,
    stats,
  }
}
