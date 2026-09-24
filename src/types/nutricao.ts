export type FoodMacros = {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export type FoodSource = 'taco' | 'off' | 'usda' | 'pantry'

export type FoodItem = {
  id: string
  code?: string
  name: string
  brand?: string
  source?: FoodSource
  per100: FoodMacros
}

export type MealSlot = 'cafe' | 'almoco' | 'lanche' | 'jantar'

export type MealEntry = {
  id: string
  dateKey: string
  meal: MealSlot
  food: FoodItem
  grams: number
  createdAt: string
}

export type NutricaoState = {
  kcalGoal: number
  proteinGoal: number
  carbsGoal: number
  fatGoal: number
  waterGoal: number
  entries: MealEntry[]
  favorites: FoodItem[]
  waterByDay: Record<string, number>
  /** kcal registadas por dia YYYY-MM-DD */
  dayLog: Record<string, number>
}
