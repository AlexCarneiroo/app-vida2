export type FoodMacros = {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export type FoodSource = 'taco' | 'off' | 'usda' | 'pantry' | 'custom'

export type FoodItem = {
  id: string
  code?: string
  name: string
  brand?: string
  source?: FoodSource
  per100: FoodMacros
}

export type MealSlot = 'cafe' | 'almoco' | 'lanche' | 'jantar'

/** 0 = domingo … 6 = sábado (Date.getDay) */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type PlanItem = {
  id: string
  meal: MealSlot
  food: FoodItem
  grams: number
  note?: string
}

export type MealPlan = {
  days: Record<Weekday, PlanItem[]>
}

export type MealEntry = {
  id: string
  dateKey: string
  meal: MealSlot
  food: FoodItem
  grams: number
  createdAt: string
  /** Liga checklist do plano → diário do dia */
  planItemId?: string
}

export type NutricaoState = {
  kcalGoal: number
  proteinGoal: number
  carbsGoal: number
  fatGoal: number
  /** Meta diária de água em ml */
  waterGoal: number
  /** ml por marca (garrafa/copo) — ex.: 600 */
  waterServingMl: number
  entries: MealEntry[]
  favorites: FoodItem[]
  /** ml bebidos por dia YYYY-MM-DD */
  waterByDay: Record<string, number>
  /** kcal registadas por dia YYYY-MM-DD */
  dayLog: Record<string, number>
  mealPlan: MealPlan
}
