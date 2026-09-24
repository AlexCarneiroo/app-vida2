import { useCallback, useMemo } from 'react'
import {
  createEntry,
  emptyNutricaoState,
  entryMacros,
  plateLine,
  plateScore,
  rebuildDayLog,
  sumMacros,
} from '../data/nutricaoDefaults'
import { dateKey } from '../lib/date'
import { loadNutricaoPersisted } from '../lib/persist'
import type { FoodItem, MealSlot, NutricaoState } from '../types/nutricao'
import { useCloudSyncedState } from './useCloudSyncedState'

const STORAGE_KEY = 'vida.nutricao.v1'

function loadDoc() {
  return loadNutricaoPersisted(STORAGE_KEY, emptyNutricaoState())
}

const isEmpty = (d: NutricaoState) =>
  d.entries.length === 0 && d.favorites.length === 0 && Object.keys(d.waterByDay).length === 0

function withDayLog(prev: NutricaoState, entries: NutricaoState['entries']): NutricaoState {
  return {
    ...prev,
    entries,
    dayLog: rebuildDayLog(entries),
  }
}

export function useNutricao() {
  const { state, update } = useCloudSyncedState<NutricaoState>({
    collection: 'nutricao',
    storageKey: STORAGE_KEY,
    load: loadDoc,
    isEmpty,
  })

  const today = dateKey()

  const todayEntries = useMemo(
    () => state.entries.filter((e) => e.dateKey === today),
    [state.entries, today],
  )

  const todayMacros = useMemo(
    () => sumMacros(todayEntries.map(entryMacros)),
    [todayEntries],
  )

  const water = state.waterByDay[today] ?? 0
  const score = plateScore(todayMacros, state)
  const coach = plateLine(todayMacros, state, water)

  const addFood = useCallback(
    (meal: MealSlot, food: FoodItem, grams: number) => {
      const entry = createEntry(today, meal, food, grams)
      update((prev) => withDayLog(prev, [...prev.entries, entry]))
      return entry.id
    },
    [today, update],
  )

  const removeEntry = useCallback(
    (id: string) => {
      update((prev) => withDayLog(prev, prev.entries.filter((e) => e.id !== id)))
    },
    [update],
  )

  const setWater = useCallback(
    (count: number) => {
      const next = Math.max(0, Math.min(16, Math.round(count)))
      update((prev) => {
        const waterByDay = { ...(prev.waterByDay ?? {}) }
        if (next <= 0) delete waterByDay[today]
        else waterByDay[today] = next
        return { ...prev, waterByDay }
      })
    },
    [today, update],
  )

  const toggleFavorite = useCallback((food: FoodItem) => {
    update((prev) => {
      const exists = prev.favorites.some((f) => f.id === food.id)
      return {
        ...prev,
        favorites: exists
          ? prev.favorites.filter((f) => f.id !== food.id)
          : [food, ...prev.favorites].slice(0, 40),
      }
    })
  }, [update])

  const setGoals = useCallback(
    (patch: Partial<Pick<NutricaoState, 'kcalGoal' | 'proteinGoal' | 'carbsGoal' | 'fatGoal' | 'waterGoal'>>) => {
      update((prev) => ({
        ...prev,
        kcalGoal: Math.max(800, Math.round(patch.kcalGoal ?? prev.kcalGoal)),
        proteinGoal: Math.max(20, Math.round(patch.proteinGoal ?? prev.proteinGoal)),
        carbsGoal: Math.max(20, Math.round(patch.carbsGoal ?? prev.carbsGoal)),
        fatGoal: Math.max(15, Math.round(patch.fatGoal ?? prev.fatGoal)),
        waterGoal: Math.max(4, Math.min(16, Math.round(patch.waterGoal ?? prev.waterGoal))),
      }))
    },
    [update],
  )

  const recentFoods = useMemo(() => {
    const seen = new Set<string>()
    const list: FoodItem[] = []
    for (const entry of [...state.entries].reverse()) {
      if (seen.has(entry.food.id)) continue
      seen.add(entry.food.id)
      list.push(entry.food)
      if (list.length >= 8) break
    }
    return list
  }, [state.entries])

  return {
    state,
    today,
    todayEntries,
    todayMacros,
    water,
    score,
    coach,
    recentFoods,
    addFood,
    removeEntry,
    setWater,
    toggleFavorite,
    setGoals,
  }
}
