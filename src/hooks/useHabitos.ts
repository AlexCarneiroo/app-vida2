import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  createHabit,
  createPersonalGoal,
  emptyHabitosState,
  isHabitDueOn,
  renewFreezes,
} from '../data/habitosDefaults'
import { loadHabitosPersisted } from '../lib/persist'
import { useCalendarDay } from './useCalendarDay'
import type {
  Habit,
  HabitInput,
  HabitosState,
  PersonalGoalInput,
} from '../types/habitos'
import { useCloudSyncedState } from './useCloudSyncedState'

const STORAGE_KEY = 'vida.habitos.v1'

function loadDoc() {
  return loadHabitosPersisted(STORAGE_KEY, emptyHabitosState())
}

const isEmpty = (d: HabitosState) =>
  d.habits.length === 0 && (d.personalGoals?.length ?? 0) === 0

function withDayLog(
  prev: HabitosState,
  habits: HabitosState['habits'],
  today: string,
): HabitosState {
  const due = habits.filter((h) => isHabitDueOn(h, today))
  const done = due.filter((h) => h.doneToday || h.skippedToday).length
  const dayLog = { ...(prev.dayLog ?? {}) }
  if (done > 0) dayLog[today] = done
  else delete dayLog[today]
  return {
    ...prev,
    dayKey: today,
    habits,
    dayLog,
  }
}

function isFreshForDay(h: Habit, today: string) {
  if (h.lastDoneDateKey === today || h.lastSkipDateKey === today) return true
  return !h.doneToday && !h.skippedToday && h.progressToday === 0
}

function resetHabitForNewDay(h: Habit): Habit {
  return {
    ...h,
    doneToday: false,
    skippedToday: false,
    progressToday: 0,
  }
}

function markComplete(h: Habit, today: string): Habit {
  const nextStreak = h.lastDoneDateKey === today ? h.streak : h.streak + 1
  return {
    ...h,
    doneToday: true,
    skippedToday: false,
    progressToday: h.goalTarget,
    lastDoneDateKey: today,
    streak: nextStreak,
    bestStreak: Math.max(h.bestStreak, nextStreak),
  }
}

export type SkipHabitResult = {
  ok: boolean
  reason?: 'not-found' | 'already-done' | 'no-freezes'
  message?: string
}

export function useHabitos() {
  const { state, update } = useCloudSyncedState<HabitosState>({
    collection: 'habitos',
    storageKey: STORAGE_KEY,
    load: loadDoc,
    isEmpty,
  })

  const today = useCalendarDay()
  const skipResultRef = useRef<SkipHabitResult>({ ok: false })

  useEffect(() => {
    const stale =
      state.dayKey !== today ||
      state.habits.some((h) => !isFreshForDay(h, today))
    if (!stale) return
    update((prev) => {
      const prevKey = prev.dayKey || today
      const crossingDay = prevKey !== today
      const habits = prev.habits.map((raw) => {
        let h = renewFreezes(raw)
        if (h.lastDoneDateKey === today) {
          return {
            ...h,
            doneToday: h.doneToday,
            skippedToday: false,
          }
        }
        if (h.lastSkipDateKey === today) {
          return {
            ...h,
            skippedToday: true,
            doneToday: false,
          }
        }
        if (crossingDay) {
          const wasDue = isHabitDueOn(h, prevKey)
          if (wasDue && !h.doneToday && !h.skippedToday && h.streak > 0) {
            h = { ...h, streak: 0 }
          }
        }
        return resetHabitForNewDay(h)
      })
      return {
        ...prev,
        dayKey: today,
        dayLog: prev.dayLog ?? {},
        habits,
      }
    })
  }, [state.dayKey, state.habits, today, update])

  useEffect(() => {
    const needsRenew = state.habits.some((h) => renewFreezes(h) !== h)
    if (!needsRenew) return
    update((prev) => ({
      ...prev,
      habits: prev.habits.map((h) => renewFreezes(h)),
    }))
  }, [state.habits, today, update])

  const habits = state.habits
  const dueToday = useMemo(
    () => habits.filter((h) => isHabitDueOn(h, today)),
    [habits, today],
  )
  const doneCount = useMemo(
    () => dueToday.filter((h) => h.doneToday).length,
    [dueToday],
  )
  const coveredCount = useMemo(
    () => dueToday.filter((h) => h.doneToday || h.skippedToday).length,
    [dueToday],
  )

  const toggleHabit = useCallback(
    (id: string) => {
      update((prev) => {
        const habitsNext = prev.habits.map((h) => {
          if (h.id !== id) return h
          if (h.doneToday) {
            return {
              ...h,
              doneToday: false,
              progressToday: 0,
              streak: Math.max(
                0,
                h.streak - (h.lastDoneDateKey === today ? 1 : 0),
              ),
              lastDoneDateKey:
                h.lastDoneDateKey === today ? null : h.lastDoneDateKey,
            }
          }
          return markComplete({ ...h, skippedToday: false }, today)
        })
        return withDayLog(prev, habitsNext, today)
      })
    },
    [today, update],
  )

  const bumpHabitProgress = useCallback(
    (id: string, delta = 1) => {
      update((prev) => {
        const habitsNext = prev.habits.map((h) => {
          if (h.id !== id) return h
          if (h.goalKind !== 'count') {
            return h.doneToday ? h : markComplete(h, today)
          }
          const next = Math.max(
            0,
            Math.min(h.goalTarget, h.progressToday + delta),
          )
          if (next >= h.goalTarget) {
            return markComplete({ ...h, progressToday: next }, today)
          }
          return {
            ...h,
            progressToday: next,
            doneToday: false,
            skippedToday: false,
          }
        })
        return withDayLog(prev, habitsNext, today)
      })
    },
    [today, update],
  )

  const skipHabit = useCallback(
    (id: string): SkipHabitResult => {
      skipResultRef.current = { ok: false, reason: 'not-found' }
      update((prev) => {
        let changed = false
        const habitsNext = prev.habits.map((h) => {
          if (h.id !== id) return h
          const fresh = renewFreezes(h)
          if (fresh.doneToday) {
            skipResultRef.current = { ok: false, reason: 'already-done' }
            return fresh
          }
          if (fresh.skippedToday) {
            skipResultRef.current = {
              ok: true,
              message: 'Já tinhas este dia protegido.',
            }
            return fresh
          }
          if (fresh.freezesLeft <= 0) {
            skipResultRef.current = {
              ok: false,
              reason: 'no-freezes',
              message:
                'Sem proteções esta semana. Conclui o hábito ou espera a próxima segunda.',
            }
            return fresh
          }
          changed = true
          skipResultRef.current = {
            ok: true,
            message:
              'Amanhã podemos melhorar isto e continuar a sequência. A tua streak está protegida.',
          }
          return {
            ...fresh,
            skippedToday: true,
            freezesLeft: fresh.freezesLeft - 1,
            lastSkipDateKey: today,
          }
        })
        return changed ? withDayLog(prev, habitsNext, today) : prev
      })
      return skipResultRef.current
    },
    [today, update],
  )

  const undoSkipHabit = useCallback(
    (id: string) => {
      update((prev) => {
        const habitsNext = prev.habits.map((h) => {
          if (h.id !== id || !h.skippedToday) return h
          return {
            ...h,
            skippedToday: false,
            freezesLeft: h.freezesLeft + 1,
          }
        })
        return withDayLog(prev, habitsNext, today)
      })
    },
    [today, update],
  )

  const addHabit = useCallback(
    (input: HabitInput | string, detail = '') => {
      const habit = createHabit(input, detail)
      update((prev) => ({
        ...prev,
        dayLog: prev.dayLog ?? {},
        habits: [habit, ...prev.habits],
      }))
      return habit.id
    },
    [update],
  )

  const updateHabit = useCallback(
    (id: string, patch: Partial<HabitInput>) => {
      update((prev) => ({
        ...prev,
        habits: prev.habits.map((h) => {
          if (h.id !== id) return h
          const goalKind = patch.goalKind ?? h.goalKind
          const goalTarget =
            goalKind === 'count'
              ? Math.max(
                  1,
                  Math.min(99, Number(patch.goalTarget ?? h.goalTarget) || 1),
                )
              : 1
          return {
            ...h,
            name:
              patch.name !== undefined ? patch.name.trim() || h.name : h.name,
            detail:
              patch.detail !== undefined ? patch.detail.trim() : h.detail,
            category: patch.category ?? h.category,
            frequency: patch.frequency ?? h.frequency,
            customDays: patch.customDays ?? h.customDays,
            goalKind,
            goalTarget,
            preferredTime:
              patch.preferredTime !== undefined
                ? patch.preferredTime
                : h.preferredTime,
            reminderEnabled:
              patch.reminderEnabled !== undefined
                ? patch.reminderEnabled
                : h.reminderEnabled,
            reminderTime:
              patch.reminderTime !== undefined
                ? patch.reminderTime
                : h.reminderTime,
            linkedGoalId:
              patch.linkedGoalId !== undefined
                ? patch.linkedGoalId?.trim() || null
                : h.linkedGoalId,
            goalBoostAmount:
              patch.goalBoostAmount !== undefined
                ? Math.max(0, Number(patch.goalBoostAmount) || 0)
                : h.goalBoostAmount,
            linkedPersonalGoalId:
              patch.linkedPersonalGoalId !== undefined
                ? patch.linkedPersonalGoalId?.trim() || null
                : h.linkedPersonalGoalId,
            personalBoost:
              patch.personalBoost !== undefined
                ? Math.max(0, Number(patch.personalBoost) || 0)
                : h.personalBoost,
            progressToday: Math.min(h.progressToday, goalTarget),
            doneToday:
              goalKind === 'count'
                ? Math.min(h.progressToday, goalTarget) >= goalTarget
                : h.doneToday,
          }
        }),
      }))
    },
    [update],
  )

  const removeHabit = useCallback(
    (id: string) => {
      update((prev) => {
        const habitsNext = prev.habits.filter((h) => h.id !== id)
        return withDayLog(prev, habitsNext, today)
      })
    },
    [today, update],
  )

  const renameHabit = useCallback(
    (id: string, name: string, detail?: string) => {
      updateHabit(id, {
        name,
        ...(detail !== undefined ? { detail } : {}),
      })
    },
    [updateHabit],
  )

  const addPersonalGoal = useCallback(
    (input: PersonalGoalInput) => {
      const goal = createPersonalGoal(input)
      update((prev) => ({
        ...prev,
        personalGoals: [goal, ...(prev.personalGoals ?? [])],
      }))
      return goal.id
    },
    [update],
  )

  const updatePersonalGoal = useCallback(
    (id: string, patch: Partial<PersonalGoalInput> & { current?: number }) => {
      update((prev) => ({
        ...prev,
        personalGoals: (prev.personalGoals ?? []).map((g) => {
          if (g.id !== id) return g
          const target = Math.max(
            0.1,
            Number(patch.target ?? g.target) || g.target,
          )
          const current = Math.max(
            0,
            Number(patch.current !== undefined ? patch.current : g.current),
          )
          return {
            ...g,
            name:
              patch.name !== undefined ? patch.name.trim() || g.name : g.name,
            detail:
              patch.detail !== undefined ? patch.detail.trim() : g.detail,
            category: patch.category ?? g.category,
            target,
            unit:
              patch.unit !== undefined
                ? patch.unit.trim() || g.unit
                : g.unit,
            defaultBoost:
              patch.defaultBoost !== undefined
                ? Math.max(0, Number(patch.defaultBoost) || 0)
                : g.defaultBoost,
            current,
            completedAt:
              current >= target
                ? g.completedAt || new Date().toISOString()
                : null,
          }
        }),
      }))
    },
    [update],
  )

  const removePersonalGoal = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        personalGoals: (prev.personalGoals ?? []).filter((g) => g.id !== id),
        habits: prev.habits.map((h) =>
          h.linkedPersonalGoalId === id
            ? { ...h, linkedPersonalGoalId: null, personalBoost: 0 }
            : h,
        ),
      }))
    },
    [update],
  )

  /** Soma progresso numa meta pessoal (ex.: ao concluir hábito ligado). */
  const bumpPersonalGoal = useCallback(
    (id: string, amount: number) => {
      if (!(amount > 0)) return
      update((prev) => ({
        ...prev,
        personalGoals: (prev.personalGoals ?? []).map((g) => {
          if (g.id !== id) return g
          const current = Math.min(g.target * 2, g.current + amount)
          return {
            ...g,
            current,
            completedAt:
              current >= g.target
                ? g.completedAt || new Date().toISOString()
                : null,
          }
        }),
      }))
    },
    [update],
  )

  return {
    habits,
    personalGoals: state.personalGoals ?? [],
    dueToday,
    doneCount,
    coveredCount,
    total: dueToday.length,
    allTotal: habits.length,
    dayLog: state.dayLog ?? {},
    toggleHabit,
    bumpHabitProgress,
    skipHabit,
    undoSkipHabit,
    addHabit,
    updateHabit,
    removeHabit,
    renameHabit,
    addPersonalGoal,
    updatePersonalGoal,
    removePersonalGoal,
    bumpPersonalGoal,
    isDueToday: (h: Habit) => isHabitDueOn(h, today),
  }
}
