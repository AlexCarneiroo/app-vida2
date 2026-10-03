import {
  emptyHabitosState,
  normalizeHabit,
  normalizePersonalGoal,
} from '../data/habitosDefaults'
import {
  clampWaterGoalMl,
  clampWaterServingMl,
  DEFAULT_WATER_SERVING_ML,
  emptyMealPlan,
  emptyNutricaoState,
  rebuildDayLog,
} from '../data/nutricaoDefaults'
import { emptyJogosState } from '../data/jogosDefaults'
import { defaultWeeklyGoals, normalizeSex } from '../data/saudeDefaults'
import { emptyRotinaState } from '../data/rotinaDefaults'
import { normalizeExerciseName } from './treinoStats'
import {
  SCHEMA_VERSION,
  isPersistedDoc,
  wrapDoc,
  type PersistedDoc,
} from './dataVersion'
import { normalizeBill, normalizeBudget } from '../data/financasDefaults'
import type {
  CategoryBudget,
  FinancasState,
  RecurringBill,
  SavingsGoal,
  Transaction,
} from '../types/financas'
import type { Habit, HabitosState, PersonalGoal } from '../types/habitos'
import type {
  FoodItem,
  MealEntry,
  MealPlan,
  MealSlot,
  NutricaoState,
  PlanItem,
  Weekday,
} from '../types/nutricao'
import type { GameBest, GameSession, JogosState } from '../types/jogos'
import type { RotinaState, RoutineBlock } from '../types/rotina'
import type {
  BodyMetric,
  HealthCheckIn,
  LabExam,
  Medication,
  ProgressPhoto,
  ProNote,
  QuickConsult,
  SaudeState,
  SleepEntry,
  SleepQuality,
} from '../types/saude'
import type {
  ActiveWorkout,
  Exercise,
  SavedCustomPlan,
  TreinoSettings,
  TreinoState,
  WorkoutTemplate,
} from '../types/treino'

const defaultSettings: TreinoSettings = {
  restSeconds: 90,
  restTimerEnabled: true,
  instructorMode: true,
  instructorQuickMode: false,
}


function ensureSourceId<T extends { id: string; sourceId?: string; name: string }>(
  ex: T,
): T & { sourceId: string } {
  return {
    ...ex,
    sourceId: ex.sourceId || ex.id || normalizeExerciseName(ex.name),
  }
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

/** Normaliza treino de qualquer versão antiga → SCHEMA_VERSION atual. */
export function normalizeTreino(raw: unknown): TreinoState {
  const parsed = (raw && typeof raw === 'object' ? raw : {}) as Partial<TreinoState>
  const history = asArray<ActiveWorkout>(parsed.history).map((w) => ({
    ...w,
    exercises: asArray<Exercise>(w.exercises).map((ex) => ensureSourceId(ex)),
  }))
  const active = parsed.active
    ? {
        ...parsed.active,
        exercises: asArray<Exercise>(parsed.active.exercises).map((ex) =>
          ensureSourceId(ex),
        ),
      }
    : null
  const plan = asArray<WorkoutTemplate>(parsed.plan)
  const savedPlans = asArray<SavedCustomPlan>(parsed.savedPlans)
    .filter((p) => p && typeof p.id === 'string' && Array.isArray(p.templates))
    .map((p) => ({
      id: p.id,
      name: (p.name || 'Plano guardado').trim() || 'Plano guardado',
      tagline: (p.tagline || '').trim(),
      savedAt: p.savedAt || new Date().toISOString(),
      templates: asArray<WorkoutTemplate>(p.templates),
    }))

  return {
    plan: plan.length > 0 ? plan : [],
    active,
    history,
    weekDone:
      parsed.weekDone && typeof parsed.weekDone === 'object'
        ? parsed.weekDone
        : {},
    settings: {
      ...defaultSettings,
      ...(parsed.settings ?? {}),
      restSeconds:
        parsed.settings?.restSeconds === 60 ||
        parsed.settings?.restSeconds === 90 ||
        parsed.settings?.restSeconds === 120
          ? parsed.settings.restSeconds
          : defaultSettings.restSeconds,
      restTimerEnabled:
        typeof parsed.settings?.restTimerEnabled === 'boolean'
          ? parsed.settings.restTimerEnabled
          : defaultSettings.restTimerEnabled,
      instructorMode:
        typeof parsed.settings?.instructorMode === 'boolean'
          ? parsed.settings.instructorMode
          : defaultSettings.instructorMode,
      instructorQuickMode:
        typeof parsed.settings?.instructorQuickMode === 'boolean'
          ? parsed.settings.instructorQuickMode
          : defaultSettings.instructorQuickMode,
    },
    activePresetId:
      parsed.activePresetId === undefined ? null : parsed.activePresetId,
    activeSavedPlanId:
      parsed.activeSavedPlanId === undefined ? null : parsed.activeSavedPlanId,
    savedPlans,
  }
}

export function normalizeFinancas(raw: unknown): FinancasState {
  const parsed = (raw && typeof raw === 'object' ? raw : {}) as Partial<FinancasState>
  const transactions = asArray<Transaction>(parsed.transactions)
    .filter((t) => t && typeof t.id === 'string' && t.amount > 0)
    .map((t) => ({
      ...t,
      note: t.note ?? '',
      dateKey: t.dateKey || '',
      createdAt: t.createdAt || new Date().toISOString(),
      type: (t.type === 'income' ? 'income' : 'expense') as Transaction['type'],
    }))

  const goals = asArray<SavingsGoal>(parsed.goals)
    .filter((g) => g && typeof g.id === 'string')
    .map((g) => ({
      id: g.id,
      name: g.name?.trim() || 'Meta',
      target: Math.max(1, Number(g.target) || 1),
      saved: Math.max(0, Number(g.saved) || 0),
    }))

  const bills = asArray<RecurringBill>(parsed.bills)
    .filter((b) => b && typeof b.id === 'string')
    .map((b) => normalizeBill(b))

  const budgets = asArray<CategoryBudget>(parsed.budgets)
    .filter((b) => b && typeof b.id === 'string')
    .map((b) => normalizeBudget(b))

  return {
    transactions,
    goals,
    bills,
    budgets,
  }
}

export function migrateTreinoDoc(input: unknown): PersistedDoc<TreinoState> {
  if (isPersistedDoc(input)) {
    const data = normalizeTreino(input.data)
    return {
      schemaVersion: SCHEMA_VERSION,
      updatedAt:
        typeof input.updatedAt === 'number' && input.updatedAt > 0
          ? input.updatedAt
          : Date.now(),
      data,
    }
  }
  // envelope legado da nuvem: { data, updatedAt } sem schemaVersion
  if (
    input &&
    typeof input === 'object' &&
    'data' in input &&
    !('plan' in input) &&
    !('transactions' in input)
  ) {
    const env = input as { data: unknown; updatedAt?: number }
    return {
      schemaVersion: SCHEMA_VERSION,
      updatedAt:
        typeof env.updatedAt === 'number' && env.updatedAt > 0
          ? env.updatedAt
          : Date.now(),
      data: normalizeTreino(env.data),
    }
  }
  return wrapDoc(normalizeTreino(input))
}

export function migrateFinancasDoc(input: unknown): PersistedDoc<FinancasState> {
  if (isPersistedDoc(input)) {
    const data = normalizeFinancas(input.data)
    return {
      schemaVersion: SCHEMA_VERSION,
      updatedAt:
        typeof input.updatedAt === 'number' && input.updatedAt > 0
          ? input.updatedAt
          : Date.now(),
      data,
    }
  }
  if (
    input &&
    typeof input === 'object' &&
    'data' in input &&
    !('transactions' in input) &&
    !('plan' in input)
  ) {
    const env = input as { data: unknown; updatedAt?: number }
    return {
      schemaVersion: SCHEMA_VERSION,
      updatedAt:
        typeof env.updatedAt === 'number' && env.updatedAt > 0
          ? env.updatedAt
          : Date.now(),
      data: normalizeFinancas(env.data),
    }
  }
  return wrapDoc(normalizeFinancas(input))
}

/**
 * Junta duas cópias sem apagar itens: útil quando relógio/dispositivo diverge.
 * Preferência: updatedAt mais recente no doc; por item, mantém ambos e deduplica por id.
 */
export function mergeFinancasSafe(
  local: FinancasState,
  remote: FinancasState,
  preferRemote: boolean,
): FinancasState {
  const txMap = new Map<string, Transaction>()
  const first = preferRemote ? remote.transactions : local.transactions
  const second = preferRemote ? local.transactions : remote.transactions
  for (const t of first) txMap.set(t.id, t)
  for (const t of second) {
    if (!txMap.has(t.id)) txMap.set(t.id, t)
  }

  const goalMap = new Map<string, SavingsGoal>()
  const gFirst = preferRemote ? remote.goals : local.goals
  const gSecond = preferRemote ? local.goals : remote.goals
  for (const g of gFirst) goalMap.set(g.id, g)
  for (const g of gSecond) {
    const prev = goalMap.get(g.id)
    if (!prev) {
      goalMap.set(g.id, g)
      continue
    }
    // nunca reduz progresso sem querer: fica o maior saved
    goalMap.set(g.id, {
      ...prev,
      name: preferRemote ? g.name || prev.name : prev.name || g.name,
      target: Math.max(prev.target, g.target),
      saved: Math.max(prev.saved, g.saved),
    })
  }

  const billMap = new Map<string, RecurringBill>()
  const bFirst = preferRemote ? remote.bills : local.bills
  const bSecond = preferRemote ? local.bills : remote.bills
  for (const b of bFirst ?? []) billMap.set(b.id, b)
  for (const b of bSecond ?? []) {
    const prev = billMap.get(b.id)
    if (!prev) {
      billMap.set(b.id, b)
      continue
    }
    const lastPaid =
      (prev.lastPaidMonth || '') >= (b.lastPaidMonth || '')
        ? prev.lastPaidMonth
        : b.lastPaidMonth
    billMap.set(b.id, {
      ...prev,
      ...(preferRemote ? b : {}),
      lastPaidMonth: lastPaid,
      name: preferRemote
        ? b.name || prev.name
        : prev.name || b.name,
      amount: Math.max(prev.amount, b.amount) > 0
        ? preferRemote
          ? b.amount || prev.amount
          : prev.amount || b.amount
        : prev.amount,
    })
  }

  const budgetMap = new Map<string, CategoryBudget>()
  const bdFirst = preferRemote ? remote.budgets : local.budgets
  const bdSecond = preferRemote ? local.budgets : remote.budgets
  for (const b of bdFirst ?? []) budgetMap.set(b.id, b)
  for (const b of bdSecond ?? []) {
    const prev = budgetMap.get(b.id)
    if (!prev) {
      budgetMap.set(b.id, b)
      continue
    }
    // Um orçamento por categoria: fica o da preferência, limite o maior
    if (prev.category === b.category) {
      budgetMap.set(b.id, {
        ...prev,
        limit: Math.max(prev.limit, b.limit),
        category: preferRemote ? b.category : prev.category,
      })
    } else if (!preferRemote) {
      /* keep prev */
    } else {
      budgetMap.set(b.id, b)
    }
  }
  // Deduplica por categoria
  const byCat = new Map<string, CategoryBudget>()
  for (const b of budgetMap.values()) {
    const prev = byCat.get(b.category)
    if (!prev || b.limit > prev.limit) byCat.set(b.category, b)
  }

  return {
    transactions: [...txMap.values()],
    goals: [...goalMap.values()],
    bills: [...billMap.values()],
    budgets: [...byCat.values()],
  }
}

export function mergeTreinoSafe(
  local: TreinoState,
  remote: TreinoState,
  preferRemote: boolean,
): TreinoState {
  const primary = preferRemote ? remote : local
  const secondary = preferRemote ? local : remote

  const histMap = new Map<string, ActiveWorkout>()
  for (const w of secondary.history) {
    const key = w.completedAt || `${w.dateKey}_${w.templateId}_${w.startedAt}`
    histMap.set(key, w)
  }
  for (const w of primary.history) {
    const key = w.completedAt || `${w.dateKey}_${w.templateId}_${w.startedAt}`
    histMap.set(key, w)
  }

  const weekDone = { ...secondary.weekDone, ...primary.weekDone }

  return normalizeTreino({
    ...secondary,
    ...primary,
    plan: primary.plan?.length ? primary.plan : secondary.plan,
    active: primary.active ?? secondary.active,
    history: [...histMap.values()].sort((a, b) =>
      (b.completedAt || b.startedAt).localeCompare(a.completedAt || a.startedAt),
    ),
    weekDone,
    settings: { ...secondary.settings, ...primary.settings },
    savedPlans: (() => {
      const map = new Map<string, SavedCustomPlan>()
      for (const p of secondary.savedPlans ?? []) map.set(p.id, p)
      for (const p of primary.savedPlans ?? []) map.set(p.id, p)
      return [...map.values()].sort((a, b) =>
        b.savedAt.localeCompare(a.savedAt),
      )
    })(),
  })
}

export function normalizeHabitos(raw: unknown): HabitosState {
  const parsed = (raw && typeof raw === 'object' ? raw : {}) as Partial<HabitosState>
  const habits = asArray<Habit>(parsed.habits)
    .filter((h) => h && typeof h.id === 'string')
    .map((h) => normalizeHabit(h))
  const personalGoals = asArray<PersonalGoal>(parsed.personalGoals)
    .filter((g) => g && typeof g.id === 'string')
    .map((g) => normalizePersonalGoal(g))
  const base = emptyHabitosState()
  const dayLogRaw =
    parsed.dayLog && typeof parsed.dayLog === 'object' ? parsed.dayLog : {}
  const dayLog: Record<string, number> = {}
  for (const [k, v] of Object.entries(dayLogRaw)) {
    const n = Number(v)
    if (n > 0) dayLog[k] = n
  }
  return {
    dayKey: parsed.dayKey || base.dayKey,
    habits,
    dayLog,
    personalGoals,
  }
}

export function normalizeRotina(raw: unknown): RotinaState {
  const parsed = (raw && typeof raw === 'object' ? raw : {}) as Partial<RotinaState>
  const blocks = asArray<RoutineBlock>(parsed.blocks)
    .filter((b) => b && typeof b.id === 'string')
    .map((b) => ({
      id: b.id,
      time: b.time || '08:00',
      title: b.title?.trim() || 'Bloco',
      detail: b.detail ?? '',
      doneToday: Boolean(b.doneToday),
    }))
    .sort((a, b) => a.time.localeCompare(b.time))
  const base = emptyRotinaState()
  const dayLogRaw =
    parsed.dayLog && typeof parsed.dayLog === 'object' ? parsed.dayLog : {}
  const dayLog: Record<string, number> = {}
  for (const [k, v] of Object.entries(dayLogRaw)) {
    const n = Number(v)
    if (n > 0) dayLog[k] = n
  }
  return {
    dayKey: parsed.dayKey || base.dayKey,
    blocks,
    dayLog,
  }
}

function migrateEnvelope<T>(
  input: unknown,
  normalize: (raw: unknown) => T,
  looksLikeData: (obj: object) => boolean,
): PersistedDoc<T> {
  // Corrige gravações antigas com double-wrap
  let cur: unknown = input
  for (let i = 0; i < 4; i++) {
    if (
      isPersistedDoc(cur) &&
      cur.data &&
      typeof cur.data === 'object' &&
      isPersistedDoc(cur.data)
    ) {
      cur = {
        schemaVersion: SCHEMA_VERSION,
        updatedAt: Math.max(cur.updatedAt || 0, cur.data.updatedAt || 0),
        data: cur.data.data,
      }
      continue
    }
    break
  }

  if (isPersistedDoc(cur)) {
    return {
      schemaVersion: SCHEMA_VERSION,
      updatedAt:
        typeof cur.updatedAt === 'number' && cur.updatedAt > 0
          ? cur.updatedAt
          : Date.now(),
      data: normalize(cur.data),
    }
  }
  if (
    cur &&
    typeof cur === 'object' &&
    'data' in cur &&
    !looksLikeData(cur)
  ) {
    const env = cur as { data: unknown; updatedAt?: number }
    return {
      schemaVersion: SCHEMA_VERSION,
      updatedAt:
        typeof env.updatedAt === 'number' && env.updatedAt > 0
          ? env.updatedAt
          : Date.now(),
      data: normalize(env.data),
    }
  }
  return wrapDoc(normalize(cur))
}

export function migrateHabitosDoc(input: unknown): PersistedDoc<HabitosState> {
  return migrateEnvelope(
    input,
    normalizeHabitos,
    (o) => 'habits' in o,
  )
}

export function migrateRotinaDoc(input: unknown): PersistedDoc<RotinaState> {
  return migrateEnvelope(
    input,
    normalizeRotina,
    (o) => 'blocks' in o,
  )
}

const MEAL_IDS: MealSlot[] = ['cafe', 'almoco', 'lanche', 'jantar']

function asMacros(raw: unknown) {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    kcal: Math.max(0, Number(o.kcal) || 0),
    protein: Math.max(0, Number(o.protein) || 0),
    carbs: Math.max(0, Number(o.carbs) || 0),
    fat: Math.max(0, Number(o.fat) || 0),
  }
}

const FOOD_SOURCES = ['taco', 'off', 'usda', 'pantry', 'custom'] as const

function normalizeFood(raw: unknown): FoodItem | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<FoodItem>
  if (typeof o.id !== 'string' || !o.id) return null
  const name = o.name?.trim()
  if (!name) return null
  const source = FOOD_SOURCES.includes(o.source as (typeof FOOD_SOURCES)[number])
    ? (o.source as FoodItem['source'])
    : undefined
  return {
    id: o.id,
    code: o.code?.trim() || undefined,
    name,
    brand: o.brand?.trim() || undefined,
    source,
    per100: asMacros(o.per100),
  }
}

function normalizeEntry(raw: unknown): MealEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<MealEntry>
  if (typeof o.id !== 'string' || !o.id) return null
  const food = normalizeFood(o.food)
  if (!food) return null
  const meal = MEAL_IDS.includes(o.meal as MealSlot) ? (o.meal as MealSlot) : 'almoco'
  const planItemId =
    typeof o.planItemId === 'string' && o.planItemId ? o.planItemId : undefined
  return {
    id: o.id,
    dateKey: o.dateKey || '',
    meal,
    food,
    grams: Math.max(1, Math.round(Number(o.grams) || 100)),
    createdAt: o.createdAt || new Date().toISOString(),
    planItemId,
  }
}

function normalizePlanItem(raw: unknown): PlanItem | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<PlanItem>
  if (typeof o.id !== 'string' || !o.id) return null
  const food = normalizeFood(o.food)
  if (!food) return null
  const meal = MEAL_IDS.includes(o.meal as MealSlot) ? (o.meal as MealSlot) : 'almoco'
  return {
    id: o.id,
    meal,
    food,
    grams: Math.max(1, Math.round(Number(o.grams) || 100)),
    note: typeof o.note === 'string' && o.note.trim() ? o.note.trim() : undefined,
  }
}

function normalizeMealPlan(raw: unknown): MealPlan {
  const base = emptyMealPlan()
  if (!raw || typeof raw !== 'object') return base
  const daysRaw = (raw as Partial<MealPlan>).days
  if (!daysRaw || typeof daysRaw !== 'object') return base
  const days = { ...base.days }
  for (let d = 0; d <= 6; d++) {
    const key = d as Weekday
    const list = asArray<PlanItem>((daysRaw as Record<string, unknown>)[String(d)])
      .map(normalizePlanItem)
      .filter((p): p is PlanItem => Boolean(p))
    days[key] = list
  }
  return { days }
}

export function normalizeNutricao(raw: unknown): NutricaoState {
  const parsed = (raw && typeof raw === 'object' ? raw : {}) as Partial<NutricaoState>
  const base = emptyNutricaoState()
  const entries = asArray<MealEntry>(parsed.entries)
    .map(normalizeEntry)
    .filter((e): e is MealEntry => Boolean(e))
  const favorites = asArray<FoodItem>(parsed.favorites)
    .map(normalizeFood)
    .filter((f): f is FoodItem => Boolean(f))
  const waterRaw =
    parsed.waterByDay && typeof parsed.waterByDay === 'object' ? parsed.waterByDay : {}
  const waterByDay: Record<string, number> = {}
  for (const [k, v] of Object.entries(waterRaw)) {
    const n = Number(v)
    if (n > 0) waterByDay[k] = n
  }
  const dayLogRaw =
    parsed.dayLog && typeof parsed.dayLog === 'object' ? parsed.dayLog : {}
  const dayLog: Record<string, number> = { ...rebuildDayLog(entries) }
  for (const [k, v] of Object.entries(dayLogRaw)) {
    const n = Number(v)
    if (n > 0) dayLog[k] = Math.max(dayLog[k] ?? 0, n)
  }

  // Legado: waterGoal ≤ 20 = contagem em copos → converte para ml
  const rawGoal = Number(parsed.waterGoal)
  const hasServing =
    typeof (parsed as { waterServingMl?: number }).waterServingMl === 'number'
  const rawServing = Number(
    (parsed as { waterServingMl?: number }).waterServingMl,
  )
  const legacyCups = Number.isFinite(rawGoal) && rawGoal > 0 && rawGoal <= 20
  const servingMl = clampWaterServingMl(
    hasServing && Number.isFinite(rawServing)
      ? rawServing
      : legacyCups
        ? 250
        : DEFAULT_WATER_SERVING_ML,
  )
  let waterGoal = clampWaterGoalMl(
    legacyCups ? rawGoal * servingMl : rawGoal || base.waterGoal,
  )
  if (legacyCups) {
    for (const k of Object.keys(waterByDay)) {
      waterByDay[k] = waterByDay[k] * servingMl
    }
  }

  return {
    kcalGoal: Math.max(800, Number(parsed.kcalGoal) || base.kcalGoal),
    proteinGoal: Math.max(20, Number(parsed.proteinGoal) || base.proteinGoal),
    carbsGoal: Math.max(20, Number(parsed.carbsGoal) || base.carbsGoal),
    fatGoal: Math.max(15, Number(parsed.fatGoal) || base.fatGoal),
    waterGoal,
    waterServingMl: servingMl,
    entries,
    favorites,
    waterByDay,
    dayLog,
    mealPlan: normalizeMealPlan(parsed.mealPlan),
  }
}

export function migrateNutricaoDoc(input: unknown): PersistedDoc<NutricaoState> {
  return migrateEnvelope(
    input,
    normalizeNutricao,
    (o) => 'entries' in o || 'kcalGoal' in o,
  )
}

export function mergeHabitosSafe(
  local: HabitosState,
  remote: HabitosState,
  preferRemote: boolean,
): HabitosState {
  const map = new Map<string, Habit>()
  const primary = preferRemote ? remote.habits : local.habits
  const secondary = preferRemote ? local.habits : remote.habits
  for (const h of secondary) map.set(h.id, h)
  for (const h of primary) {
    const prev = map.get(h.id)
    if (!prev) {
      map.set(h.id, h)
      continue
    }
    map.set(h.id, {
      ...prev,
      ...h,
      streak: Math.max(prev.streak, h.streak),
      doneToday: prev.doneToday || h.doneToday,
      lastDoneDateKey: h.lastDoneDateKey ?? prev.lastDoneDateKey,
    })
  }

  const dayLog: Record<string, number> = {
    ...(local.dayLog ?? {}),
  }
  for (const [k, v] of Object.entries(remote.dayLog ?? {})) {
    dayLog[k] = Math.max(dayLog[k] ?? 0, v)
  }

  const goalMap = new Map<string, PersonalGoal>()
  const gPrimary = preferRemote
    ? remote.personalGoals ?? []
    : local.personalGoals ?? []
  const gSecondary = preferRemote
    ? local.personalGoals ?? []
    : remote.personalGoals ?? []
  for (const g of gSecondary) goalMap.set(g.id, g)
  for (const g of gPrimary) {
    const prev = goalMap.get(g.id)
    if (!prev) {
      goalMap.set(g.id, g)
      continue
    }
    const current = Math.max(prev.current, g.current)
    const target = Math.max(prev.target, g.target)
    goalMap.set(g.id, {
      ...prev,
      ...g,
      current,
      target,
      completedAt:
        current >= target
          ? g.completedAt || prev.completedAt || new Date().toISOString()
          : null,
    })
  }

  return {
    dayKey: preferRemote
      ? remote.dayKey || local.dayKey
      : local.dayKey || remote.dayKey,
    habits: [...map.values()],
    dayLog,
    personalGoals: [...goalMap.values()],
  }
}

export function mergeRotinaSafe(
  local: RotinaState,
  remote: RotinaState,
  preferRemote: boolean,
): RotinaState {
  const map = new Map<string, RoutineBlock>()
  const primary = preferRemote ? remote.blocks : local.blocks
  const secondary = preferRemote ? local.blocks : remote.blocks
  for (const b of secondary) map.set(b.id, b)
  for (const b of primary) {
    const prev = map.get(b.id)
    if (!prev) {
      map.set(b.id, b)
      continue
    }
    map.set(b.id, {
      ...prev,
      ...b,
      doneToday: prev.doneToday || b.doneToday,
    })
  }

  const dayLog: Record<string, number> = {
    ...(local.dayLog ?? {}),
  }
  for (const [k, v] of Object.entries(remote.dayLog ?? {})) {
    dayLog[k] = Math.max(dayLog[k] ?? 0, v)
  }

  return {
    dayKey: preferRemote
      ? remote.dayKey || local.dayKey
      : local.dayKey || remote.dayKey,
    blocks: [...map.values()].sort((a, b) => a.time.localeCompare(b.time)),
    dayLog,
  }
}

export function mergeNutricaoSafe(
  local: NutricaoState,
  remote: NutricaoState,
  preferRemote: boolean,
): NutricaoState {
  const entryMap = new Map<string, MealEntry>()
  const primary = preferRemote ? remote.entries : local.entries
  const secondary = preferRemote ? local.entries : remote.entries
  for (const e of secondary) entryMap.set(e.id, e)
  for (const e of primary) entryMap.set(e.id, e)

  const favMap = new Map<string, FoodItem>()
  const favPrimary = preferRemote ? remote.favorites : local.favorites
  const favSecondary = preferRemote ? local.favorites : remote.favorites
  for (const f of favSecondary) favMap.set(f.id, f)
  for (const f of favPrimary) favMap.set(f.id, f)

  const waterByDay: Record<string, number> = { ...(local.waterByDay ?? {}) }
  for (const [k, v] of Object.entries(remote.waterByDay ?? {})) {
    waterByDay[k] = Math.max(waterByDay[k] ?? 0, v)
  }

  const entries = [...entryMap.values()]
  const dayLog = rebuildDayLog(entries)
  for (const [k, v] of Object.entries(local.dayLog ?? {})) {
    dayLog[k] = Math.max(dayLog[k] ?? 0, v)
  }
  for (const [k, v] of Object.entries(remote.dayLog ?? {})) {
    dayLog[k] = Math.max(dayLog[k] ?? 0, v)
  }

  const planDays = emptyMealPlan().days
  for (let d = 0; d <= 6; d++) {
    const key = d as Weekday
    const map = new Map<string, PlanItem>()
    const sec = preferRemote
      ? local.mealPlan?.days?.[key] ?? []
      : remote.mealPlan?.days?.[key] ?? []
    const pri = preferRemote
      ? remote.mealPlan?.days?.[key] ?? []
      : local.mealPlan?.days?.[key] ?? []
    for (const p of sec) map.set(p.id, p)
    for (const p of pri) map.set(p.id, p)
    planDays[key] = [...map.values()]
  }

  const goals = preferRemote ? remote : local
  return {
    kcalGoal: goals.kcalGoal,
    proteinGoal: goals.proteinGoal,
    carbsGoal: goals.carbsGoal,
    fatGoal: goals.fatGoal,
    waterGoal: goals.waterGoal,
    waterServingMl: goals.waterServingMl ?? DEFAULT_WATER_SERVING_ML,
    entries,
    favorites: [...favMap.values()],
    waterByDay,
    dayLog,
    mealPlan: { days: planDays },
  }
}

function asQuality(n: unknown): SleepQuality {
  const v = Math.round(Number(n) || 3)
  if (v <= 1) return 1
  if (v === 2) return 2
  if (v === 4) return 4
  if (v >= 5) return 5
  return 3
}

function optNum(n: unknown): number | undefined {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return undefined
  return Math.round(v * 10) / 10
}

function normalizeMetric(raw: unknown): BodyMetric | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<BodyMetric>
  if (typeof o.id !== 'string' || !o.id) return null
  const weightKg = Number(o.weightKg)
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null
  return {
    id: o.id,
    dateKey: o.dateKey || '',
    weightKg: Math.round(weightKg * 10) / 10,
    waistCm: optNum(o.waistCm),
    armCm: optNum(o.armCm),
    bodyFatPct: optNum(o.bodyFatPct),
    leanMassKg: optNum(o.leanMassKg),
    note: typeof o.note === 'string' && o.note.trim() ? o.note.trim() : undefined,
    createdAt: o.createdAt || new Date().toISOString(),
  }
}

function normalizeSleep(raw: unknown): SleepEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<SleepEntry>
  if (typeof o.id !== 'string' || !o.id) return null
  return {
    id: o.id,
    dateKey: o.dateKey || '',
    hours: Math.max(0, Math.min(24, Number(o.hours) || 0)),
    quality: asQuality(o.quality),
    bedTime: typeof o.bedTime === 'string' ? o.bedTime : null,
    wakeTime: typeof o.wakeTime === 'string' ? o.wakeTime : null,
    note: typeof o.note === 'string' && o.note.trim() ? o.note.trim() : undefined,
  }
}

function normalizeExam(raw: unknown): LabExam | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<LabExam>
  if (typeof o.id !== 'string' || !o.id) return null
  const name = o.name?.trim()
  if (!name) return null
  return {
    id: o.id,
    dateKey: o.dateKey || '',
    name,
    value: (o.value ?? '—').toString().trim() || '—',
    unit: typeof o.unit === 'string' && o.unit.trim() ? o.unit.trim() : undefined,
    refRange:
      typeof o.refRange === 'string' && o.refRange.trim()
        ? o.refRange.trim()
        : undefined,
    note: typeof o.note === 'string' && o.note.trim() ? o.note.trim() : undefined,
    nextDueDateKey:
      typeof o.nextDueDateKey === 'string' && o.nextDueDateKey
        ? o.nextDueDateKey
        : null,
    attachmentName:
      typeof o.attachmentName === 'string' ? o.attachmentName : undefined,
    attachmentDataUrl:
      typeof o.attachmentDataUrl === 'string' &&
      o.attachmentDataUrl.startsWith('data:')
        ? o.attachmentDataUrl
        : undefined,
    createdAt: o.createdAt || new Date().toISOString(),
  }
}

function normalizeCheckIn(raw: unknown): HealthCheckIn | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<HealthCheckIn>
  if (typeof o.id !== 'string' || !o.id) return null
  return {
    id: o.id,
    dateKey: o.dateKey || '',
    energy: asQuality(o.energy),
    mood: asQuality(o.mood),
    symptoms:
      typeof o.symptoms === 'string' && o.symptoms.trim()
        ? o.symptoms.trim()
        : undefined,
  }
}

function normalizeMedication(raw: unknown): Medication | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<Medication>
  if (typeof o.id !== 'string' || !o.id) return null
  const name = o.name?.trim()
  if (!name) return null
  return {
    id: o.id,
    name,
    dose: typeof o.dose === 'string' ? o.dose : '',
    time: typeof o.time === 'string' && o.time ? o.time : '08:00',
    enabled: o.enabled !== false,
    lastTakenDateKey:
      typeof o.lastTakenDateKey === 'string' ? o.lastTakenDateKey : null,
  }
}

function normalizePhoto(raw: unknown): ProgressPhoto | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<ProgressPhoto>
  if (typeof o.id !== 'string' || !o.id) return null
  if (typeof o.dataUrl !== 'string' || !o.dataUrl.startsWith('data:image')) {
    return null
  }
  return {
    id: o.id,
    dateKey: o.dateKey || '',
    dataUrl: o.dataUrl,
    note: typeof o.note === 'string' && o.note.trim() ? o.note.trim() : undefined,
    createdAt: o.createdAt || new Date().toISOString(),
  }
}

function normalizeProNote(raw: unknown): ProNote | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<ProNote>
  if (typeof o.id !== 'string' || !o.id) return null
  const body = o.body?.trim()
  if (!body) return null
  return {
    id: o.id,
    author: o.author?.trim() || 'Dra. Pulse',
    body,
    createdAt: o.createdAt || new Date().toISOString(),
  }
}

function normalizeConsult(raw: unknown): QuickConsult | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<QuickConsult>
  if (!o.dateKey || !Array.isArray(o.plan)) return null
  return {
    dateKey: o.dateKey,
    q1: String(o.q1 ?? ''),
    q2: String(o.q2 ?? ''),
    q3: String(o.q3 ?? ''),
    plan: o.plan.map(String).filter(Boolean).slice(0, 8),
  }
}

export function normalizeSaude(raw: unknown): SaudeState {
  const parsed = (raw && typeof raw === 'object' ? raw : {}) as Partial<SaudeState>
  return {
    heightCm: Math.max(0, Math.min(250, Math.round(Number(parsed.heightCm) || 0))),
    sex: normalizeSex(parsed.sex),
    weightGoalKg: Math.max(0, Math.min(400, Number(parsed.weightGoalKg) || 0)),
    sleepReminderEnabled: Boolean(parsed.sleepReminderEnabled),
    sleepReminderTime:
      typeof parsed.sleepReminderTime === 'string' && parsed.sleepReminderTime
        ? parsed.sleepReminderTime
        : '22:30',
    weeklyGoals: defaultWeeklyGoals(parsed.weeklyGoals),
    metrics: asArray<BodyMetric>(parsed.metrics)
      .map(normalizeMetric)
      .filter((m): m is BodyMetric => Boolean(m)),
    sleep: asArray<SleepEntry>(parsed.sleep)
      .map(normalizeSleep)
      .filter((s): s is SleepEntry => Boolean(s)),
    exams: asArray<LabExam>(parsed.exams)
      .map(normalizeExam)
      .filter((e): e is LabExam => Boolean(e)),
    checkIns: asArray<HealthCheckIn>(parsed.checkIns)
      .map(normalizeCheckIn)
      .filter((c): c is HealthCheckIn => Boolean(c)),
    medications: asArray<Medication>(parsed.medications)
      .map(normalizeMedication)
      .filter((m): m is Medication => Boolean(m)),
    photos: asArray<ProgressPhoto>(parsed.photos)
      .map(normalizePhoto)
      .filter((p): p is ProgressPhoto => Boolean(p))
      .slice(0, 8),
    lastConsult: normalizeConsult(parsed.lastConsult),
    proNotes: asArray<ProNote>(parsed.proNotes)
      .map(normalizeProNote)
      .filter((n): n is ProNote => Boolean(n))
      .slice(0, 40),
  }
}

export function migrateSaudeDoc(input: unknown): PersistedDoc<SaudeState> {
  return migrateEnvelope(
    input,
    normalizeSaude,
    (o) =>
      'metrics' in o ||
      'sleep' in o ||
      'exams' in o ||
      'heightCm' in o ||
      'checkIns' in o ||
      'medications' in o,
  )
}

function mergeById<T extends { id: string }>(
  local: T[],
  remote: T[],
  preferRemote: boolean,
): T[] {
  const map = new Map<string, T>()
  const primary = preferRemote ? remote : local
  const secondary = preferRemote ? local : remote
  for (const item of secondary) map.set(item.id, item)
  for (const item of primary) map.set(item.id, item)
  return [...map.values()]
}

export function mergeSaudeSafe(
  local: SaudeState,
  remote: SaudeState,
  preferRemote: boolean,
): SaudeState {
  const profile = preferRemote ? remote : local
  return {
    heightCm: profile.heightCm || local.heightCm || remote.heightCm,
    sex: profile.sex ?? local.sex ?? remote.sex,
    weightGoalKg:
      profile.weightGoalKg || local.weightGoalKg || remote.weightGoalKg,
    sleepReminderEnabled: profile.sleepReminderEnabled,
    sleepReminderTime: profile.sleepReminderTime || '22:30',
    weeklyGoals: defaultWeeklyGoals(profile.weeklyGoals),
    metrics: mergeById(local.metrics, remote.metrics, preferRemote),
    sleep: mergeById(local.sleep, remote.sleep, preferRemote),
    exams: mergeById(local.exams, remote.exams, preferRemote),
    checkIns: mergeById(local.checkIns, remote.checkIns, preferRemote),
    medications: mergeById(local.medications, remote.medications, preferRemote),
    photos: mergeById(local.photos, remote.photos, preferRemote).slice(0, 8),
    lastConsult: preferRemote
      ? remote.lastConsult ?? local.lastConsult
      : local.lastConsult ?? remote.lastConsult,
    proNotes: mergeById(local.proNotes, remote.proNotes, preferRemote).slice(
      0,
      40,
    ),
  }
}

function normalizeGameSession(raw: unknown): GameSession | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<GameSession>
  if (typeof o.id !== 'string' || !o.id) return null
  if (typeof o.gameId !== 'string' || !o.gameId) return null
  return {
    id: o.id,
    gameId: o.gameId,
    dateKey: o.dateKey || '',
    durationSec: Math.max(0, Math.round(Number(o.durationSec) || 0)),
    score:
      o.score !== undefined && Number.isFinite(Number(o.score))
        ? Math.round(Number(o.score))
        : undefined,
    level:
      o.level !== undefined && Number.isFinite(Number(o.level))
        ? Math.max(1, Math.round(Number(o.level)))
        : undefined,
    createdAt: o.createdAt || new Date().toISOString(),
  }
}

function normalizeGameBest(raw: unknown): GameBest | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<GameBest>
  if (typeof o.gameId !== 'string' || !o.gameId) return null
  return {
    gameId: o.gameId,
    bestScore: Math.max(0, Math.round(Number(o.bestScore) || 0)),
    bestLevel: Math.max(0, Math.round(Number(o.bestLevel) || 0)),
    plays: Math.max(0, Math.round(Number(o.plays) || 0)),
    lastPlayedAt: o.lastPlayedAt || '',
    lastDateKey: o.lastDateKey || '',
  }
}

export function normalizeJogos(raw: unknown): JogosState {
  const parsed =
    raw && typeof raw === 'object' ? (raw as Partial<JogosState>) : {}
  const base = emptyJogosState()
  const dayLogRaw =
    parsed.dayLog && typeof parsed.dayLog === 'object' ? parsed.dayLog : {}
  const dayLog: Record<string, number> = {}
  for (const [k, v] of Object.entries(dayLogRaw)) {
    const n = Number(v)
    if (n > 0) dayLog[k] = n
  }
  const sessions = asArray<unknown>(parsed.sessions)
    .map(normalizeGameSession)
    .filter((s): s is GameSession => Boolean(s))
    .slice(0, 200)
  const bestByGame = asArray<unknown>(parsed.bestByGame)
    .map(normalizeGameBest)
    .filter((b): b is GameBest => Boolean(b))
  return {
    dayLog,
    sessions,
    bestByGame,
    totalMinutes: Math.max(
      0,
      Number(parsed.totalMinutes) || base.totalMinutes,
    ),
  }
}

export function migrateJogosDoc(input: unknown): PersistedDoc<JogosState> {
  return migrateEnvelope(
    input,
    normalizeJogos,
    (o) => 'sessions' in o || 'dayLog' in o || 'bestByGame' in o,
  )
}

export function mergeJogosSafe(
  local: JogosState,
  remote: JogosState,
  preferRemote: boolean,
): JogosState {
  const sessions = mergeById(
    local.sessions,
    remote.sessions,
    preferRemote,
  ).slice(0, 200)

  const bestMap = new Map<string, GameBest>()
  const bestPrimary = preferRemote ? remote.bestByGame : local.bestByGame
  const bestSecondary = preferRemote ? local.bestByGame : remote.bestByGame
  for (const b of bestSecondary) bestMap.set(b.gameId, b)
  for (const b of bestPrimary) {
    const prev = bestMap.get(b.gameId)
    if (!prev) {
      bestMap.set(b.gameId, b)
      continue
    }
    bestMap.set(b.gameId, {
      gameId: b.gameId,
      bestScore: Math.max(prev.bestScore, b.bestScore),
      bestLevel: Math.max(prev.bestLevel, b.bestLevel),
      plays: Math.max(prev.plays, b.plays),
      lastPlayedAt:
        (prev.lastPlayedAt || '') >= (b.lastPlayedAt || '')
          ? prev.lastPlayedAt || b.lastPlayedAt
          : b.lastPlayedAt || prev.lastPlayedAt,
      lastDateKey:
        (prev.lastDateKey || '') >= (b.lastDateKey || '')
          ? prev.lastDateKey || b.lastDateKey
          : b.lastDateKey || prev.lastDateKey,
    })
  }

  const dayLog: Record<string, number> = { ...(local.dayLog ?? {}) }
  for (const [k, v] of Object.entries(remote.dayLog ?? {})) {
    dayLog[k] = Math.max(dayLog[k] ?? 0, v)
  }

  return {
    dayLog,
    sessions,
    bestByGame: [...bestMap.values()],
    totalMinutes: Math.max(local.totalMinutes, remote.totalMinutes),
  }
}
