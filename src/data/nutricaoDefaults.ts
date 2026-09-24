import { dateKey } from '../lib/date'
import { uid } from '../lib/storage'
import type {
  FoodItem,
  FoodMacros,
  MealEntry,
  MealSlot,
  NutricaoState,
} from '../types/nutricao'

export const MEAL_SLOTS: Array<{ id: MealSlot; label: string; hint: string }> = [
  { id: 'cafe', label: 'Café', hint: 'Manhã' },
  { id: 'almoco', label: 'Almoço', hint: 'Meio-dia' },
  { id: 'lanche', label: 'Lanche', hint: 'Tarde' },
  { id: 'jantar', label: 'Jantar', hint: 'Noite' },
]

/** Despensa local — alimentos comuns no Brasil, por 100 g. */
export const PANTRY: FoodItem[] = [
  pantry('arroz', 'Arroz branco cozido', { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 }),
  pantry('feijao', 'Feijão carioca cozido', { kcal: 76, protein: 4.8, carbs: 14, fat: 0.5 }),
  pantry('frango', 'Frango grelhado', { kcal: 165, protein: 31, carbs: 0, fat: 3.6 }),
  pantry('ovo', 'Ovo cozido', { kcal: 155, protein: 13, carbs: 1.1, fat: 11 }),
  pantry('banana', 'Banana prata', { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 }),
  pantry('aveia', 'Aveia em flocos', { kcal: 389, protein: 17, carbs: 66, fat: 7 }),
  pantry('pao', 'Pão francês', { kcal: 300, protein: 9, carbs: 58, fat: 3.1 }),
  pantry('leite', 'Leite integral', { kcal: 61, protein: 3.2, carbs: 4.6, fat: 3.3 }),
  pantry('batata', 'Batata doce cozida', { kcal: 86, protein: 1.6, carbs: 20, fat: 0.1 }),
  pantry('whey', 'Whey protein', { kcal: 400, protein: 80, carbs: 8, fat: 6 }),
  pantry('azeite', 'Azeite', { kcal: 884, protein: 0, carbs: 0, fat: 100 }),
  pantry('brocolis', 'Brócolis cozido', { kcal: 35, protein: 2.4, carbs: 7, fat: 0.4 }),
  pantry('iogurte', 'Iogurte natural', { kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.3 }),
  pantry('carne', 'Carne moída grelhada', { kcal: 250, protein: 26, carbs: 0, fat: 15 }),
  pantry('macarrao', 'Macarrão cozido', { kcal: 131, protein: 5, carbs: 25, fat: 1.1 }),
  pantry('queijo', 'Queijo minas', { kcal: 264, protein: 17, carbs: 3, fat: 20 }),
  pantry('maca', 'Maçã', { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 }),
  pantry('atum', 'Atum em água', { kcal: 116, protein: 26, carbs: 0, fat: 0.8 }),
]

function pantry(slug: string, name: string, per100: FoodMacros): FoodItem {
  return { id: `pantry_${slug}`, name, source: 'pantry', per100 }
}

export const emptyNutricaoState = (): NutricaoState => ({
  kcalGoal: 2200,
  proteinGoal: 140,
  carbsGoal: 220,
  fatGoal: 70,
  waterGoal: 8,
  entries: [],
  favorites: [],
  waterByDay: {},
  dayLog: {},
})

export function createEntry(
  date: string,
  meal: MealSlot,
  food: FoodItem,
  grams: number,
): MealEntry {
  return {
    id: uid('meal'),
    dateKey: date,
    meal,
    food,
    grams: Math.max(1, Math.round(grams)),
    createdAt: new Date().toISOString(),
  }
}

export function round1(n: number) {
  return Math.round(n * 10) / 10
}

export function scaleMacros(per100: FoodMacros, grams: number): FoodMacros {
  const f = Math.max(0, grams) / 100
  return {
    kcal: Math.round(per100.kcal * f),
    protein: round1(per100.protein * f),
    carbs: round1(per100.carbs * f),
    fat: round1(per100.fat * f),
  }
}

export function entryMacros(entry: MealEntry): FoodMacros {
  return scaleMacros(entry.food.per100, entry.grams)
}

export function sumMacros(list: FoodMacros[]): FoodMacros {
  return list.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein: round1(acc.protein + m.protein),
      carbs: round1(acc.carbs + m.carbs),
      fat: round1(acc.fat + m.fat),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

export function rebuildDayLog(entries: MealEntry[]): Record<string, number> {
  const dayLog: Record<string, number> = {}
  for (const entry of entries) {
    const kcal = scaleMacros(entry.food.per100, entry.grams).kcal
    if (kcal <= 0) continue
    dayLog[entry.dateKey] = (dayLog[entry.dateKey] ?? 0) + kcal
  }
  return dayLog
}

export function plateScore(today: FoodMacros, goals: Pick<NutricaoState, 'kcalGoal' | 'proteinGoal'>) {
  if (today.kcal <= 0) return 0
  const kcalRatio = today.kcal / Math.max(1, goals.kcalGoal)
  const kcalPts = kcalRatio <= 1 ? kcalRatio : Math.max(0, 1 - (kcalRatio - 1) * 1.4)
  const proteinPts = Math.min(1, today.protein / Math.max(1, goals.proteinGoal))
  return Math.round((kcalPts * 0.55 + proteinPts * 0.45) * 100)
}

export function plateLine(today: FoodMacros, goals: NutricaoState, water: number) {
  if (today.kcal <= 0) {
    return 'O prato ainda está vazio. Começa pela despensa ou procura na base mundial.'
  }
  if (today.protein < goals.proteinGoal * 0.55 && today.kcal < goals.kcalGoal * 0.85) {
    return 'Proteína ainda baixa — frango, ovo ou whey fecham o buraco.'
  }
  if (today.kcal > goals.kcalGoal * 1.12) {
    return 'Já passou o alvo de calorias. Água e um passeio fecham o dia.'
  }
  if (water < Math.ceil(goals.waterGoal * 0.5)) {
    return 'Comida no caminho. Falta hidratar — marca um copo.'
  }
  if (today.kcal >= goals.kcalGoal * 0.75 && today.protein >= goals.proteinGoal * 0.75) {
    return 'Prato equilibrado. Assim o corpo agradece.'
  }
  return 'Registo a crescer. Mantém o ritmo até ao jantar.'
}

export function filterPantry(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return PANTRY
  return PANTRY.filter((item) => item.name.toLowerCase().includes(q))
}
