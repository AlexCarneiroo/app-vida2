import { useCallback, useMemo } from 'react'
import {
  clampWaterGoalMl,
  clampWaterServingMl,
  createCustomFood,
  createEntry,
  createPlanItem,
  emptyMealPlan,
  emptyNutricaoState,
  entryMacros,
  plateLine,
  plateScore,
  rebuildDayLog,
  sumMacros,
  waterServingSlots,
  weekdayFromDateKey,
} from '../data/nutricaoDefaults'
import { dateKey, shiftDateKey } from '../lib/date'
import { loadNutricaoPersisted } from '../lib/persist'
import type {
  FoodItem,
  FoodMacros,
  MealSlot,
  NutricaoState,
  PlanItem,
  Weekday,
} from '../types/nutricao'
import { useCloudSyncedState } from './useCloudSyncedState'

const STORAGE_KEY = 'vida.nutricao.v1'

function loadDoc() {
  return loadNutricaoPersisted(STORAGE_KEY, emptyNutricaoState())
}

const isEmpty = (d: NutricaoState) =>
  d.entries.length === 0 &&
  d.favorites.length === 0 &&
  Object.keys(d.waterByDay).length === 0 &&
  WEEKDAY_KEYS.every((k) => (d.mealPlan?.days?.[k]?.length ?? 0) === 0)

const WEEKDAY_KEYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6]

function withDayLog(
  prev: NutricaoState,
  entries: NutricaoState['entries'],
): NutricaoState {
  return {
    ...prev,
    entries,
    dayLog: rebuildDayLog(entries),
  }
}

function ensurePlan(prev: NutricaoState): NutricaoState['mealPlan'] {
  return prev.mealPlan?.days ? prev.mealPlan : emptyMealPlan()
}

function patchDay(
  plan: NutricaoState['mealPlan'],
  day: Weekday,
  items: PlanItem[],
): NutricaoState['mealPlan'] {
  return {
    days: {
      ...plan.days,
      [day]: items,
    },
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
  const todayWeekday = weekdayFromDateKey(today)

  const todayEntries = useMemo(
    () => state.entries.filter((e) => e.dateKey === today),
    [state.entries, today],
  )

  const todayMacros = useMemo(
    () => sumMacros(todayEntries.map(entryMacros)),
    [todayEntries],
  )

  const mealPlan = state.mealPlan ?? emptyMealPlan()
  const todayPlanItems = mealPlan.days[todayWeekday] ?? []

  const planDoneIds = useMemo(() => {
    const set = new Set<string>()
    for (const e of todayEntries) {
      if (e.planItemId) set.add(e.planItemId)
    }
    return set
  }, [todayEntries])

  const planPending = useMemo(
    () => todayPlanItems.filter((p) => !planDoneIds.has(p.id)).length,
    [todayPlanItems, planDoneIds],
  )

  const water = state.waterByDay[today] ?? 0
  const score = plateScore(todayMacros, state)
  const coach = plateLine(todayMacros, state, water, planPending)

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
      update((prev) =>
        withDayLog(
          prev,
          prev.entries.filter((e) => e.id !== id),
        ),
      )
    },
    [update],
  )

  const updateEntry = useCallback(
    (
      id: string,
      patch: { grams?: number; food?: FoodItem; meal?: MealSlot },
    ) => {
      update((prev) =>
        withDayLog(
          prev,
          prev.entries.map((e) => {
            if (e.id !== id) return e
            return {
              ...e,
              grams:
                patch.grams !== undefined
                  ? Math.max(1, Math.round(patch.grams))
                  : e.grams,
              food: patch.food
                ? { ...patch.food, per100: { ...patch.food.per100 } }
                : e.food,
              meal: patch.meal ?? e.meal,
            }
          }),
        ),
      )
    },
    [update],
  )

  /** Define ml totais do dia (0 = limpar). */
  const setWaterMl = useCallback(
    (ml: number) => {
      const next = Math.max(0, Math.min(8000, Math.round(ml)))
      update((prev) => {
        const waterByDay = { ...(prev.waterByDay ?? {}) }
        if (next <= 0) delete waterByDay[today]
        else waterByDay[today] = next
        return { ...prev, waterByDay }
      })
    },
    [today, update],
  )

  /** Marca n garrafas (n × waterServingMl). Toggle: mesma marca outra vez desce uma. */
  const setWaterServings = useCallback(
    (servings: number) => {
      update((prev) => {
        const serving = clampWaterServingMl(prev.waterServingMl)
        if (serving <= 0) return prev
        const slots = waterServingSlots(prev.waterGoal, serving)
        const n = Math.max(0, Math.min(slots, Math.round(servings)))
        const next = n * serving
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
    (
      patch: Partial<
        Pick<
          NutricaoState,
          | 'kcalGoal'
          | 'proteinGoal'
          | 'carbsGoal'
          | 'fatGoal'
          | 'waterGoal'
          | 'waterServingMl'
        >
      >,
    ) => {
      update((prev) => ({
        ...prev,
        kcalGoal: Math.max(800, Math.round(patch.kcalGoal ?? prev.kcalGoal)),
        proteinGoal: Math.max(
          20,
          Math.round(patch.proteinGoal ?? prev.proteinGoal),
        ),
        carbsGoal: Math.max(20, Math.round(patch.carbsGoal ?? prev.carbsGoal)),
        fatGoal: Math.max(15, Math.round(patch.fatGoal ?? prev.fatGoal)),
        waterGoal: clampWaterGoalMl(patch.waterGoal ?? prev.waterGoal),
        waterServingMl: clampWaterServingMl(
          patch.waterServingMl ?? prev.waterServingMl,
        ),
      }))
    },
    [update],
  )

  const addPlanItem = useCallback(
    (day: Weekday, meal: MealSlot, food: FoodItem, grams: number) => {
      const item = createPlanItem(meal, food, grams)
      update((prev) => {
        const plan = ensurePlan(prev)
        const list = [...(plan.days[day] ?? []), item]
        return { ...prev, mealPlan: patchDay(plan, day, list) }
      })
      return item.id
    },
    [update],
  )

  const updatePlanItem = useCallback(
    (
      day: Weekday,
      id: string,
      patch: { grams?: number; food?: FoodItem; meal?: MealSlot; note?: string },
    ) => {
      update((prev) => {
        const plan = ensurePlan(prev)
        const list = (plan.days[day] ?? []).map((p) => {
          if (p.id !== id) return p
          return {
            ...p,
            grams:
              patch.grams !== undefined
                ? Math.max(1, Math.round(patch.grams))
                : p.grams,
            food: patch.food
              ? { ...patch.food, per100: { ...patch.food.per100 } }
              : p.food,
            meal: patch.meal ?? p.meal,
            note:
              patch.note !== undefined
                ? patch.note.trim() || undefined
                : p.note,
          }
        })
        return { ...prev, mealPlan: patchDay(plan, day, list) }
      })
    },
    [update],
  )

  const removePlanItem = useCallback(
    (day: Weekday, id: string) => {
      update((prev) => {
        const plan = ensurePlan(prev)
        const list = (plan.days[day] ?? []).filter((p) => p.id !== id)
        // Remove diary links for today if same plan item
        const entries = prev.entries.filter((e) => e.planItemId !== id)
        return withDayLog(
          { ...prev, mealPlan: patchDay(plan, day, list) },
          entries,
        )
      })
    },
    [update],
  )

  const copyPlanDay = useCallback(
    (from: Weekday, to: Weekday[] | 'weekdays') => {
      update((prev) => {
        const plan = ensurePlan(prev)
        const source = plan.days[from] ?? []
        const targets: Weekday[] =
          to === 'weekdays' ? [1, 2, 3, 4, 5] : to
        let days = { ...plan.days }
        for (const day of targets) {
          if (day === from) continue
          days = {
            ...days,
            [day]: source.map((p) =>
              createPlanItem(p.meal, p.food, p.grams, p.note),
            ),
          }
        }
        return { ...prev, mealPlan: { days } }
      })
    },
    [update],
  )

  const copyDiaryToPlanDay = useCallback(
    (day: Weekday, fromDateKey?: string): boolean => {
      const sourceKey = fromDateKey ?? shiftDateKey(today, -1)
      let applied = false
      update((prev) => {
        const plan = ensurePlan(prev)
        const diary = prev.entries.filter((e) => e.dateKey === sourceKey)
        if (diary.length === 0) return prev
        applied = true
        const items = diary.map((e) =>
          createPlanItem(e.meal, e.food, e.grams),
        )
        return { ...prev, mealPlan: patchDay(plan, day, items) }
      })
      return applied
    },
    [today, update],
  )

  const togglePlanItemDone = useCallback(
    (item: PlanItem) => {
      update((prev) => {
        const existing = prev.entries.find(
          (e) => e.dateKey === today && e.planItemId === item.id,
        )
        if (existing) {
          return withDayLog(
            prev,
            prev.entries.filter((e) => e.id !== existing.id),
          )
        }
        const entry = createEntry(
          today,
          item.meal,
          item.food,
          item.grams,
          item.id,
        )
        return withDayLog(prev, [...prev.entries, entry])
      })
    },
    [today, update],
  )

  const adjustPlanEntryGrams = useCallback(
    (planItemId: string, grams: number) => {
      update((prev) =>
        withDayLog(
          prev,
          prev.entries.map((e) => {
            if (e.dateKey !== today || e.planItemId !== planItemId) return e
            return { ...e, grams: Math.max(1, Math.round(grams)) }
          }),
        ),
      )
    },
    [today, update],
  )

  const createManualFood = useCallback(
    (input: {
      name: string
      brand?: string
      per100: FoodMacros
    }) => createCustomFood(input),
    [],
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
    todayWeekday,
    todayEntries,
    todayMacros,
    todayPlanItems,
    planDoneIds,
    planPending,
    mealPlan,
    water,
    score,
    coach,
    recentFoods,
    addFood,
    removeEntry,
    updateEntry,
    setWaterMl,
    setWaterServings,
    toggleFavorite,
    setGoals,
    addPlanItem,
    updatePlanItem,
    removePlanItem,
    copyPlanDay,
    copyDiaryToPlanDay,
    togglePlanItemDone,
    adjustPlanEntryGrams,
    createManualFood,
  }
}
