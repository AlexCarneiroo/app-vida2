import { TACO_FOODS } from '../data/tacoFoods'
import { scaleMacros } from '../data/nutricaoDefaults'
import type { FoodItem, FoodMacros } from '../types/nutricao'

type OffNutriments = Record<string, unknown>

type OffProduct = {
  code?: string
  product_name?: string
  product_name_pt?: string
  brands?: string | string[]
  nutriments?: OffNutriments
}

type OffSearch = {
  products?: OffProduct[]
  hits?: OffProduct[]
}

const OFF_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'AppVida/1.2 (nutrition; https://app-vida2.vercel.app)',
}

type UsdaNutrient = {
  nutrientId?: number
  nutrientName?: string
  value?: number
  unitName?: string
}

type UsdaFood = {
  fdcId?: number
  description?: string
  brandName?: string
  brandOwner?: string
  dataType?: string
  foodNutrients?: UsdaNutrient[]
}

type UsdaSearch = {
  foods?: UsdaFood[]
}

export type FoodSearchResult = {
  taco: FoodItem[]
  off: FoodItem[]
  usda: FoodItem[]
}

function num(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

function kcalFrom(n: OffNutriments): number {
  const kcal = num(n['energy-kcal_100g'] ?? n.energy_kcal_100g)
  if (kcal > 0) return Math.round(kcal)
  const kj = num(n.energy_100g ?? n['energy-kj_100g'])
  if (kj > 0) return Math.round(kj / 4.184)
  return 0
}

function macrosFrom(n: OffNutriments): FoodMacros | null {
  const kcal = kcalFrom(n)
  const protein = num(n.proteins_100g)
  const carbs = num(n.carbohydrates_100g)
  const fat = num(n.fat_100g)
  if (kcal <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return null
  if (protein > 90 || carbs > 120 || fat > 105 || kcal > 950) return null
  return {
    kcal,
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
  }
}

function mapProduct(product: OffProduct): FoodItem | null {
  const name = (product.product_name_pt || product.product_name || '').trim()
  if (!name) return null
  const per100 = macrosFrom(product.nutriments ?? {})
  if (!per100) return null
  const code = (product.code || '').trim()
  const rawBrand = Array.isArray(product.brands)
    ? product.brands[0]
    : (product.brands || '').split(',')[0]
  const brand = (rawBrand || '').trim()
  return {
    id: code ? `off_${code}` : `off_${name.toLowerCase().replace(/\s+/g, '_').slice(0, 40)}`,
    code: code || undefined,
    name,
    brand: brand || undefined,
    source: 'off',
    per100,
  }
}

function usdaValue(nutrients: UsdaNutrient[], ids: number[], names: string[]) {
  for (const item of nutrients) {
    if (ids.includes(item.nutrientId ?? -1)) return num(item.value)
    const label = (item.nutrientName || '').toLowerCase()
    if (names.some((n) => label.includes(n))) return num(item.value)
  }
  return 0
}

function mapUsda(food: UsdaFood): FoodItem | null {
  const name = (food.description || '').trim()
  const id = food.fdcId
  if (!name || !id) return null
  const nutrients = food.foodNutrients ?? []
  const kcal = Math.round(usdaValue(nutrients, [1008], ['energy']))
  const protein = usdaValue(nutrients, [1003], ['protein'])
  const carbs = usdaValue(nutrients, [1005], ['carbohydrate'])
  const fat = usdaValue(nutrients, [1004], ['total lipid', 'fat'])
  if (kcal <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return null
  const brand = (food.brandName || food.brandOwner || '').trim()
  return {
    id: `usda_${id}`,
    name,
    brand: brand || undefined,
    source: 'usda',
    per100: {
      kcal,
      protein: Math.round(protein * 10) / 10,
      carbs: Math.round(carbs * 10) / 10,
      fat: Math.round(fat * 10) / 10,
    },
  }
}

export function searchTaco(query: string, limit = 40): FoodItem[] {
  const q = fold(query)
  if (q.length < 2) return []
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2)
  const starts: FoodItem[] = []
  const phrase: FoodItem[] = []
  const partial: FoodItem[] = []
  for (const item of TACO_FOODS) {
    const name = fold(item.name)
    const brand = fold(item.brand || '')
    const hay = `${name} ${brand}`
    if (name.startsWith(q) || name.includes(`, ${q}`)) starts.push(item)
    else if (hay.includes(q) || tokens.every((t) => hay.includes(t))) phrase.push(item)
    else if (tokens.some((t) => name.includes(t) || brand.includes(t))) partial.push(item)
  }
  return rankFoods([...starts, ...phrase, ...partial], query).slice(0, limit)
}

function collectOff(products: OffProduct[] | undefined) {
  const seen = new Set<string>()
  const items: FoodItem[] = []
  for (const product of products ?? []) {
    const item = mapProduct(product)
    if (!item || seen.has(item.id)) continue
    seen.add(item.id)
    items.push(item)
  }
  return items
}

async function searchOffEngine(
  query: string,
  page: number,
  signal?: AbortSignal,
): Promise<FoodItem[]> {
  const url = new URL('https://search.openfoodfacts.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('page_size', '24')
  url.searchParams.set('page', String(page))
  const res = await fetch(url.toString(), { signal, headers: OFF_HEADERS })
  if (!res.ok) throw new Error('openfoodfacts-search')
  const data = (await res.json()) as OffSearch
  return collectOff(data.hits)
}

async function searchOffCgi(
  query: string,
  page: number,
  signal?: AbortSignal,
): Promise<FoodItem[]> {
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl')
  url.searchParams.set('search_terms', query)
  url.searchParams.set('search_simple', '1')
  url.searchParams.set('action', 'process')
  url.searchParams.set('json', '1')
  url.searchParams.set('page_size', '24')
  url.searchParams.set('page', String(page))
  const res = await fetch(url.toString(), { signal, headers: OFF_HEADERS })
  if (!res.ok) throw new Error('openfoodfacts')
  const data = (await res.json()) as OffSearch
  return collectOff(data.products)
}

/** Open Food Facts mundial — milhões de produtos embalados, sem chave. */
export async function searchOpenFoodFacts(
  query: string,
  signal?: AbortSignal,
): Promise<FoodItem[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const first = await searchOffEngine(q, 1, signal).catch(() => searchOffCgi(q, 1, signal))
  let extra: FoodItem[] = []
  try {
    extra = await searchOffEngine(q, 2, signal).catch(() => searchOffCgi(q, 2, signal))
  } catch {
    extra = []
  }
  const seen = new Set<string>()
  const items: FoodItem[] = []
  for (const item of [...first, ...extra]) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    items.push(item)
  }
  return rankFoods(items, q)
}

/** USDA FoodData Central — tabela científica + marcas. */
export async function searchUsdaFoods(
  query: string,
  signal?: AbortSignal,
): Promise<FoodItem[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const key = import.meta.env.VITE_USDA_API_KEY || 'DEMO_KEY'
  const res = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        query: q,
        pageSize: 40,
        dataType: ['Branded', 'Foundation', 'SR Legacy', 'Survey (FNDDS)'],
      }),
    },
  )
  if (!res.ok) return []
  const data = (await res.json()) as UsdaSearch
  const seen = new Set<string>()
  const items: FoodItem[] = []
  for (const food of data.foods ?? []) {
    const item = mapUsda(food)
    if (!item || seen.has(item.id)) continue
    seen.add(item.id)
    items.push(item)
    if (items.length >= 30) break
  }
  return items
}

/** TACO + Open Food Facts + USDA em paralelo. */
export async function searchFoods(
  query: string,
  signal?: AbortSignal,
): Promise<FoodSearchResult> {
  const taco = searchTaco(query)
  const remote = await Promise.allSettled([
    searchOpenFoodFacts(query, signal),
    searchUsdaFoods(query, signal),
  ])
  const off = remote[0].status === 'fulfilled' ? remote[0].value : []
  const usda = remote[1].status === 'fulfilled' ? remote[1].value : []
  const remoteDown = remote[0].status === 'rejected' && remote[1].status === 'rejected'
  if (remoteDown && taco.length === 0 && off.length === 0 && usda.length === 0) {
    throw new Error('food-search')
  }
  return {
    taco: rankFoods(taco, query),
    off: rankFoods(off, query),
    usda: rankFoods(usda, query),
  }
}

export function parseFoodQuery(raw: string): { query: string; grams: number | null } {
  let text = raw.trim()
  let grams: number | null = null
  const gramMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|gramas?)\b/i)
  if (gramMatch) {
    grams = Math.max(1, Math.round(Number(gramMatch[1].replace(',', '.'))))
    text = text.replace(gramMatch[0], ' ')
  }
  text = text
    .replace(/\b(da|de|do|das|dos|marca|comi|comer|pacote|pct|tipo)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return { query: text, grams }
}

export function rankFoods(items: FoodItem[], query: string): FoodItem[] {
  const q = fold(query)
  if (!q) return items
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2)
  return [...items].sort((a, b) => scoreFood(b, q, tokens) - scoreFood(a, q, tokens))
}

function scoreFood(item: FoodItem, q: string, tokens: string[]) {
  const name = fold(item.name)
  const brand = fold(item.brand || '')
  let score = 0
  if (brand && (brand === q || brand.startsWith(q))) score += 90
  else if (brand.includes(q)) score += 70
  if (name.startsWith(q)) score += 60
  else if (name.includes(q)) score += 35
  for (const token of tokens) {
    if (brand.includes(token)) score += 40
    if (name.includes(token)) score += 12
  }
  if (item.source === 'off' && brand) score += 8
  return score
}

export function productBrand(item: FoodItem) {
  if (item.source !== 'off' && item.source !== 'usda') return undefined
  return item.brand?.trim() || undefined
}

export function foodHint(item: FoodItem, grams = 100) {
  const macros = scaleMacros(item.per100, grams)
  return `${macros.kcal} kcal · ${macros.protein}g prot`
}
