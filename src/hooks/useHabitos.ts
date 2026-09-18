import { useCallback, useEffect, useMemo } from 'react'
import { createHabit, emptyHabitosState } from '../data/habitosDefaults'
import { dateKey } from '../lib/date'
import { loadHabitosPersisted } from '../lib/persist'
import type { HabitosState } from '../types/habitos'
import { useCloudSyncedState } from './useCloudSyncedState'

const STORAGE_KEY = 'vida.habitos.v1'

function loadDoc() {
  return loadHabitosPersisted(STORAGE_KEY, emptyHabitosState())
}

const isEmpty = (d: HabitosState) => d.habits.length === 0

export function useHabitos() {
  const { state, update } = useCloudSyncedState<HabitosState>({
    collection: 'habitos',
    storageKey: STORAGE_KEY,
    load: loadDoc,
    isEmpty,
  })

  const today = dateKey()

  useEffect(() => {
    if (state.dayKey === today) return
    update((prev) => ({
      dayKey: today,
      habits: prev.habits.map((h) => ({ ...h, doneToday: false })),
    }))
  }, [state.dayKey, today, update])

  const habits = state.habits
  const doneCount = useMemo(
    () => habits.filter((h) => h.doneToday).length,
    [habits],
  )

  const toggleHabit = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        dayKey: today,
        habits: prev.habits.map((h) => {
          if (h.id !== id) return h
          const markingDone = !h.doneToday
          return {
            ...h,
            doneToday: markingDone,
            lastDoneDateKey: markingDone ? today : h.lastDoneDateKey,
            streak: markingDone
              ? h.lastDoneDateKey === today
                ? h.streak
                : h.streak + 1
              : Math.max(0, h.streak - (h.lastDoneDateKey === today ? 1 : 0)),
          }
        }),
      }))
    },
    [today, update],
  )

  const addHabit = useCallback(
    (name: string, detail = '') => {
      const habit = createHabit(name, detail)
      update((prev) => ({ ...prev, habits: [habit, ...prev.habits] }))
      return habit.id
    },
    [update],
  )

  const removeHabit = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        habits: prev.habits.filter((h) => h.id !== id),
      }))
    },
    [update],
  )

  const renameHabit = useCallback(
    (id: string, name: string, detail?: string) => {
      update((prev) => ({
        ...prev,
        habits: prev.habits.map((h) =>
          h.id === id
            ? {
                ...h,
                name: name.trim() || h.name,
                detail: detail !== undefined ? detail.trim() : h.detail,
              }
            : h,
        ),
      }))
    },
    [update],
  )

  return {
    habits,
    doneCount,
    total: habits.length,
    toggleHabit,
    addHabit,
    removeHabit,
    renameHabit,
  }
}
