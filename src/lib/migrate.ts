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
import {
  DEFAULT_SLEEP_ROUTINE,
  defaultWeeklyGoals,
  normalizeSex,
} from '../data/saudeDefaults'
import { minutesToTime, parseTimeToMinutes } from './agendaEngine'
import { normalizeAgendaState } from '../data/agendaDefaults'
import { emptyRotinaState } from '../data/rotinaDefaults'
import { exercisesForMuscle } from '../data/exerciseLibrary'
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
import type {
  AgendaEvent,
  AgendaState,
  AvailabilityException,
} from '../types/agenda'
import type { RotinaState, RoutineBlock } from '../types/rotina'
import type {
  BodyMetric,
  HealthCheckIn,
  LabExam,
  Medication,
  NapEntry,
  ProgressPhoto,
  ProNote,
  QuickConsult,
  SaudeState,
  SleepChallenge,
  SleepEntry,
  SleepQuality,
  SleepRoutineItem,
} from '../types/saude'
import type {
  ActiveWorkout,
  CustomExercise,
  Exercise,
  ExerciseLoadMemory,
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
  const activeRaw = parsed.active
    ? {
        ...parsed.active,
        exercises: asArray<Exercise>(parsed.active.exercises).map((ex) =>
          ensureSourceId(ex),
        ),
      }
    : null
  // Sessão já concluída não pode reaparecer como treino em andamento.
  const active = activeRaw && sessionWasCompleted(activeRaw, history) ? null : activeRaw
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
  const customExercises: CustomExercise[] = []
  const customKeys = new Set<string>()
  for (const exercise of asArray<CustomExercise>(parsed.customExercises)) {
    if (!exercise || typeof exercise.name !== 'string') continue
    const name = exercise.name.trim()
    const muscle = exercise.muscle
    if (!name || !exercisesForMuscle(muscle).length) continue
    const key = `${muscle}:${normalizeExerciseName(name)}`
    if (
      customKeys.has(key) ||
      exercisesForMuscle(muscle).some(
        (item) => normalizeExerciseName(item) === normalizeExerciseName(name),
      )
    ) {
      continue
    }
    customKeys.add(key)
    customExercises.push({
      name,
      muscle,
      addedAt:
        typeof exercise.addedAt === 'string'
          ? exercise.addedAt
          : new Date().toISOString(),
    })
  }
  const exerciseLoadMemory: Record<string, ExerciseLoadMemory> = {}
  const rawMemory =
    parsed.exerciseLoadMemory &&
    typeof parsed.exerciseLoadMemory === 'object'
      ? parsed.exerciseLoadMemory
      : {}

  for (const [rawKey, rawEntry] of Object.entries(rawMemory)) {
    if (!rawEntry || typeof rawEntry !== 'object') continue
    const entry = rawEntry as ExerciseLoadMemory
    const sets = asArray<{ reps: number; weight: number }>(entry.sets)
      .map((set) => ({
        reps: Math.max(0, Number(set.reps) || 0),
        weight: Math.max(0, Number(set.weight) || 0),
      }))
    if (sets.length === 0) continue
    const name = typeof entry.name === 'string' ? entry.name.trim() : rawKey
    const key = normalizeExerciseName(name || rawKey)
    if (!key) continue
    exerciseLoadMemory[key] = {
      name: name || rawKey,
      sets,
      updatedAt:
        typeof entry.updatedAt === 'string'
          ? entry.updatedAt
          : new Date().toISOString(),
    }
  }

  // Dados antigos passam a beneficiar automaticamente das últimas cargas.
  for (const workout of history) {
    for (const exercise of workout.exercises) {
      const key = normalizeExerciseName(exercise.name)
      if (!key || exerciseLoadMemory[key]) continue
      const done = exercise.sets.filter((set) => set.done)
      if (done.length === 0) continue
      exerciseLoadMemory[key] = {
        name: exercise.name,
        sets: done.map((set) => ({ reps: set.reps, weight: set.weight })),
        updatedAt: workout.completedAt || workout.startedAt,
      }
    }
  }

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
    planName:
      typeof parsed.planName === 'string'
        ? parsed.planName.trim()
        : savedPlans.find((p) => p.id === parsed.activeSavedPlanId)?.name ?? '',
    exerciseLoadMemory,
    customExercises,
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

/** A sessão aberta é a mesma que já entrou no histórico como concluída. */
function sessionWasCompleted(
  active: ActiveWorkout,
  history: ActiveWorkout[],
): boolean {
  if (!active.startedAt) return false
  return history.some(
    (w) => Boolean(w.completedAt) && w.startedAt === active.startedAt,
  )
}

function resolveActiveWorkout(
  primary: TreinoState,
  history: ActiveWorkout[],
): ActiveWorkout | null {
  const newer = primary.active ?? null
  if (!newer || sessionWasCompleted(newer, history)) return null
  return newer
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
  const history = [...histMap.values()].sort((a, b) =>
    (b.completedAt || b.startedAt).localeCompare(a.completedAt || a.startedAt),
  )

  const weekDone = { ...secondary.weekDone, ...primary.weekDone }

  return normalizeTreino({
    ...secondary,
    ...primary,
    plan: primary.plan?.length ? primary.plan : secondary.plan,
    active: resolveActiveWorkout(primary, history),
    history,
    weekDone,
    settings: { ...secondary.settings, ...primary.settings },
    exerciseLoadMemory: {
      ...(secondary.exerciseLoadMemory ?? {}),
      ...(primary.exerciseLoadMemory ?? {}),
    },
    customExercises: [
      ...(secondary.customExercises ?? []),
      ...(primary.customExercises ?? []),
    ],
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
  const weightKg = Number(o.weightKg)
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null
  const dateKey = typeof o.dateKey === 'string' ? o.dateKey : ''
  const id =
    typeof o.id === 'string' && o.id
      ? o.id
      : `metric_legacy_${dateKey || 'x'}_${Math.round(weightKg * 10)}`
  return {
    id,
    dateKey,
    weightKg: Math.round(weightKg * 10) / 10,
    waistCm: optNum(o.waistCm),
    armCm: optNum(o.armCm),
    bodyFatPct: optNum(o.bodyFatPct),
    leanMassKg: optNum(o.leanMassKg),
    note: typeof o.note === 'string' && o.note.trim() ? o.note.trim() : undefined,
    createdAt: o.createdAt || new Date().toISOString(),
  }
}

function normalizeSleepHabits(raw: unknown): SleepEntry['habits'] {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const hasAny =
    'phoneBeforeBed' in o ||
    'caffeineLate' in o ||
    'exerciseLate' in o ||
    'alcohol' in o ||
    'heavyMeal' in o
  if (!hasAny) return undefined
  return {
    phoneBeforeBed: Boolean(o.phoneBeforeBed),
    caffeineLate: Boolean(o.caffeineLate),
    exerciseLate: Boolean(o.exerciseLate),
    alcohol: Boolean(o.alcohol),
    heavyMeal: Boolean(o.heavyMeal),
  }
}

function asTimeOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return parseTimeToMinutes(trimmed) == null ? null : trimmed
}

function shiftTimeByHours(time: string, hours: number): string | null {
  const base = parseTimeToMinutes(time)
  if (base == null || !Number.isFinite(hours) || hours === 0) return null
  const total =
    (((base + Math.round(hours * 60)) % (24 * 60)) + 24 * 60) % (24 * 60)
  return minutesToTime(total)
}

function sleepEntryScore(entry: SleepEntry): number {
  let score = 0
  if (entry.hours > 0) score += 2
  if (entry.bedTime) score += 1
  if (entry.wakeTime) score += 1
  if (entry.readiness != null) score += 1
  if (entry.latencyMin != null) score += 1
  if (entry.awakenings != null) score += 1
  if (entry.habits) score += 1
  if (entry.note) score += 1
  return score
}

function mergeSleepFields(a: SleepEntry, b: SleepEntry): SleepEntry {
  const prefer = sleepEntryScore(b) >= sleepEntryScore(a) ? b : a
  const other = prefer === a ? b : a
  return {
    ...other,
    ...prefer,
    hours: prefer.hours > 0 ? prefer.hours : other.hours,
    quality: prefer.quality || other.quality,
    readiness: prefer.readiness ?? other.readiness,
    bedTime: prefer.bedTime || other.bedTime || null,
    wakeTime: prefer.wakeTime || other.wakeTime || null,
    latencyMin: prefer.latencyMin ?? other.latencyMin,
    awakenings: prefer.awakenings ?? other.awakenings,
    habits: prefer.habits ?? other.habits,
    note: prefer.note || other.note,
  }
}

function dedupeSleepByDay(entries: SleepEntry[]): SleepEntry[] {
  const map = new Map<string, SleepEntry>()
  const orphan: SleepEntry[] = []
  for (const entry of entries) {
    if (!entry.dateKey) {
      orphan.push(entry)
      continue
    }
    const prev = map.get(entry.dateKey)
    map.set(entry.dateKey, prev ? mergeSleepFields(prev, entry) : entry)
  }
  return [...map.values(), ...orphan]
}

function inferSleepTimes(
  entry: SleepEntry,
  goalBed: string,
  goalWake: string,
): SleepEntry {
  if (entry.hours <= 0) return entry
  let bedTime = entry.bedTime || null
  let wakeTime = entry.wakeTime || null
  if (bedTime && wakeTime) return entry

  if (bedTime && !wakeTime) {
    wakeTime = shiftTimeByHours(bedTime, entry.hours)
  } else if (wakeTime && !bedTime) {
    bedTime = shiftTimeByHours(wakeTime, -entry.hours)
  } else {
    bedTime = goalBed
    wakeTime =
      shiftTimeByHours(goalBed, entry.hours) ||
      goalWake ||
      shiftTimeByHours(goalBed, 8)
  }

  return {
    ...entry,
    bedTime: bedTime || entry.bedTime || null,
    wakeTime: wakeTime || entry.wakeTime || null,
  }
}

function mergeDefaultSleepRoutine(
  existing: SleepRoutineItem[],
): SleepRoutineItem[] {
  const map = new Map<string, SleepRoutineItem>()
  for (const item of existing) map.set(item.id, item)
  for (const def of DEFAULT_SLEEP_ROUTINE) {
    if (!map.has(def.id)) map.set(def.id, { ...def })
  }
  return [...map.values()]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .slice(0, 20)
}

function normalizeSleep(raw: unknown): SleepEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<SleepEntry> & Record<string, unknown>
  const dateKey = typeof o.dateKey === 'string' ? o.dateKey : ''
  const hours = Math.max(0, Math.min(24, Number(o.hours) || 0))
  const quality = asQuality(o.quality)
  const id =
    typeof o.id === 'string' && o.id
      ? o.id
      : dateKey
        ? `sleep_legacy_${dateKey}_${Math.round(hours * 10)}_${quality}`
        : ''
  if (!id) return null
  // Registo vazio sem horas/qualidade útil — ignora lixo
  if (hours <= 0 && o.quality == null && !o.bedTime && !o.wakeTime) return null

  const latency =
    o.latencyMin !== undefined && Number.isFinite(Number(o.latencyMin))
      ? Math.max(0, Math.min(180, Math.round(Number(o.latencyMin))))
      : undefined
  const awakenings =
    o.awakenings !== undefined && Number.isFinite(Number(o.awakenings))
      ? Math.max(0, Math.min(30, Math.round(Number(o.awakenings))))
      : undefined
  return {
    id,
    dateKey,
    hours,
    quality,
    readiness:
      o.readiness !== undefined && o.readiness !== null
        ? asQuality(o.readiness)
        : undefined,
    bedTime: asTimeOrNull(o.bedTime),
    wakeTime: asTimeOrNull(o.wakeTime),
    latencyMin: latency,
    awakenings,
    habits: normalizeSleepHabits(o.habits),
    note: typeof o.note === 'string' && o.note.trim() ? o.note.trim() : undefined,
  }
}

function normalizeNap(raw: unknown): NapEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<NapEntry>
  if (typeof o.id !== 'string' || !o.id) return null
  if (typeof o.startTime !== 'string' || typeof o.endTime !== 'string') return null
  return {
    id: o.id,
    dateKey: o.dateKey || '',
    startTime: o.startTime,
    endTime: o.endTime,
    minutes: Math.max(1, Math.min(240, Math.round(Number(o.minutes) || 1))),
    note: typeof o.note === 'string' && o.note.trim() ? o.note.trim() : undefined,
    createdAt: o.createdAt || new Date().toISOString(),
  }
}

function normalizeRoutineItem(raw: unknown): SleepRoutineItem | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<SleepRoutineItem>
  if (typeof o.id !== 'string' || !o.id) return null
  const label = o.label?.trim()
  if (!label) return null
  return {
    id: o.id,
    label,
    enabled: o.enabled !== false,
    order: Math.max(0, Math.round(Number(o.order) || 0)),
  }
}

function normalizeChallenge(raw: unknown): SleepChallenge | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<SleepChallenge>
  if (typeof o.id !== 'string' || !o.id) return null
  const kind = Number(o.kind)
  if (kind !== 7 && kind !== 14 && kind !== 30) return null
  if (typeof o.startDateKey !== 'string' || !o.startDateKey) return null
  return {
    id: o.id,
    kind: kind as 7 | 14 | 30,
    startDateKey: o.startDateKey,
    active: o.active !== false,
    completedDateKey:
      typeof o.completedDateKey === 'string' ? o.completedDateKey : null,
  }
}

function normalizeExam(raw: unknown): LabExam | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<LabExam>
  const name = o.name?.trim()
  if (!name) return null
  const dateKey = typeof o.dateKey === 'string' ? o.dateKey : ''
  const id =
    typeof o.id === 'string' && o.id
      ? o.id
      : `exam_legacy_${dateKey || 'x'}_${name.toLowerCase().replace(/\s+/g, '_')}`
  return {
    id,
    dateKey,
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
  const dateKey = typeof o.dateKey === 'string' ? o.dateKey : ''
  const energy = asQuality(o.energy)
  const mood = asQuality(o.mood)
  const id =
    typeof o.id === 'string' && o.id
      ? o.id
      : dateKey
        ? `checkin_legacy_${dateKey}_${energy}_${mood}`
        : ''
  if (!id) return null
  return {
    id,
    dateKey,
    energy,
    mood,
    symptoms:
      typeof o.symptoms === 'string' && o.symptoms.trim()
        ? o.symptoms.trim()
        : undefined,
  }
}

function normalizeMedication(raw: unknown): Medication | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<Medication>
  const name = o.name?.trim()
  if (!name) return null
  const id =
    typeof o.id === 'string' && o.id
      ? o.id
      : `med_legacy_${name.toLowerCase().replace(/\s+/g, '_')}`
  return {
    id,
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
  const routineRaw = asArray<SleepRoutineItem>(parsed.sleepRoutine)
    .map(normalizeRoutineItem)
    .filter((r): r is SleepRoutineItem => Boolean(r))
  const routineDone: Record<string, string[]> = {}
  if (parsed.sleepRoutineDone && typeof parsed.sleepRoutineDone === 'object') {
    for (const [key, value] of Object.entries(parsed.sleepRoutineDone)) {
      if (!Array.isArray(value)) continue
      routineDone[key] = value.map(String).filter(Boolean).slice(0, 20)
    }
  }

  const checkIns = asArray<HealthCheckIn>(parsed.checkIns)
    .map(normalizeCheckIn)
    .filter((c): c is HealthCheckIn => Boolean(c))

  const energyByDay = new Map<string, SleepQuality>()
  for (const checkIn of checkIns) {
    if (!checkIn.dateKey) continue
    // Mantém a energia mais recente / última no array para o dia
    energyByDay.set(checkIn.dateKey, checkIn.energy)
  }

  let sleep = dedupeSleepByDay(
    asArray<SleepEntry>(parsed.sleep)
      .map(normalizeSleep)
      .filter((s): s is SleepEntry => Boolean(s))
      .map((entry) =>
        entry.readiness != null
          ? entry
          : energyByDay.has(entry.dateKey)
            ? { ...entry, readiness: energyByDay.get(entry.dateKey) }
            : entry,
      ),
  )

  const reminderTime =
    typeof parsed.sleepReminderTime === 'string' &&
    asTimeOrNull(parsed.sleepReminderTime)
      ? parsed.sleepReminderTime
      : '22:30'

  const hasExplicitGoalHours =
    parsed.sleepGoalHours !== undefined &&
    parsed.sleepGoalHours !== null &&
    Number(parsed.sleepGoalHours) > 0
  const hasExplicitGoalBed =
    typeof parsed.sleepGoalBedTime === 'string' &&
    Boolean(asTimeOrNull(parsed.sleepGoalBedTime))
  const hasExplicitGoalWake =
    typeof parsed.sleepGoalWakeTime === 'string' &&
    Boolean(asTimeOrNull(parsed.sleepGoalWakeTime))

  let sleepGoalHours = hasExplicitGoalHours
    ? Math.max(5, Math.min(12, Number(parsed.sleepGoalHours)))
    : 8
  if (!hasExplicitGoalHours && sleep.length >= 5) {
    const avgHours =
      sleep.reduce((sum, entry) => sum + entry.hours, 0) / sleep.length
    if (Number.isFinite(avgHours) && avgHours >= 5 && avgHours <= 12) {
      sleepGoalHours = Math.max(
        5,
        Math.min(12, Math.round(avgHours * 2) / 2),
      )
    }
  }

  const sleepGoalBedTime = hasExplicitGoalBed
    ? (asTimeOrNull(parsed.sleepGoalBedTime) as string)
    : reminderTime

  let sleepGoalWakeTime = hasExplicitGoalWake
    ? (asTimeOrNull(parsed.sleepGoalWakeTime) as string)
    : shiftTimeByHours(sleepGoalBedTime, sleepGoalHours) || '06:30'

  sleep = sleep.map((entry) =>
    inferSleepTimes(entry, sleepGoalBedTime, sleepGoalWakeTime),
  )

  return {
    heightCm: Math.max(0, Math.min(250, Math.round(Number(parsed.heightCm) || 0))),
    sex: normalizeSex(parsed.sex),
    weightGoalKg: Math.max(0, Math.min(400, Number(parsed.weightGoalKg) || 0)),
    sleepReminderEnabled: Boolean(parsed.sleepReminderEnabled),
    sleepReminderTime: reminderTime,
    sleepGoalHours,
    sleepGoalBedTime,
    sleepGoalWakeTime,
    windDownEnabled: parsed.windDownEnabled !== false,
    windDownMinutes: Math.max(
      10,
      Math.min(180, Math.round(Number(parsed.windDownMinutes) || 45)),
    ),
    weeklyGoals: defaultWeeklyGoals(parsed.weeklyGoals),
    metrics: asArray<BodyMetric>(parsed.metrics)
      .map(normalizeMetric)
      .filter((m): m is BodyMetric => Boolean(m)),
    sleep,
    naps: asArray<NapEntry>(parsed.naps)
      .map(normalizeNap)
      .filter((n): n is NapEntry => Boolean(n))
      .slice(0, 200),
    sleepRoutine: mergeDefaultSleepRoutine(
      routineRaw.length > 0
        ? routineRaw
        : DEFAULT_SLEEP_ROUTINE.map((r) => ({ ...r })),
    ),
    sleepRoutineDone: routineDone,
    sleepChallenge: normalizeChallenge(parsed.sleepChallenge),
    exams: asArray<LabExam>(parsed.exams)
      .map(normalizeExam)
      .filter((e): e is LabExam => Boolean(e)),
    checkIns,
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

function mergeSleepLists(
  local: SleepEntry[],
  remote: SleepEntry[],
  preferRemote: boolean,
): SleepEntry[] {
  const byId = new Map<string, SleepEntry>()
  const primary = preferRemote ? remote : local
  const secondary = preferRemote ? local : remote
  for (const entry of secondary) byId.set(entry.id, entry)
  for (const entry of primary) {
    const prev = byId.get(entry.id)
    byId.set(entry.id, prev ? mergeSleepFields(prev, entry) : entry)
  }
  return dedupeSleepByDay([...byId.values()])
}

export function mergeSaudeSafe(
  local: SaudeState,
  remote: SaudeState,
  preferRemote: boolean,
): SaudeState {
  const profile = preferRemote ? remote : local
  const routineDone = {
    ...(preferRemote ? local.sleepRoutineDone : remote.sleepRoutineDone),
    ...(preferRemote ? remote.sleepRoutineDone : local.sleepRoutineDone),
  }
  return normalizeSaude({
    heightCm: profile.heightCm || local.heightCm || remote.heightCm,
    sex: profile.sex ?? local.sex ?? remote.sex,
    weightGoalKg:
      profile.weightGoalKg || local.weightGoalKg || remote.weightGoalKg,
    sleepReminderEnabled: profile.sleepReminderEnabled,
    sleepReminderTime: profile.sleepReminderTime || '22:30',
    sleepGoalHours: profile.sleepGoalHours || local.sleepGoalHours || 8,
    sleepGoalBedTime:
      profile.sleepGoalBedTime || local.sleepGoalBedTime || '22:30',
    sleepGoalWakeTime:
      profile.sleepGoalWakeTime || local.sleepGoalWakeTime || '06:30',
    windDownEnabled: profile.windDownEnabled,
    windDownMinutes: profile.windDownMinutes || local.windDownMinutes || 45,
    weeklyGoals: defaultWeeklyGoals(profile.weeklyGoals),
    metrics: mergeById(local.metrics, remote.metrics, preferRemote),
    sleep: mergeSleepLists(local.sleep, remote.sleep, preferRemote),
    naps: mergeById(local.naps, remote.naps, preferRemote).slice(0, 200),
    sleepRoutine: mergeDefaultSleepRoutine(
      mergeById(local.sleepRoutine, remote.sleepRoutine, preferRemote),
    ),
    sleepRoutineDone: routineDone,
    sleepChallenge: preferRemote
      ? remote.sleepChallenge ?? local.sleepChallenge
      : local.sleepChallenge ?? remote.sleepChallenge,
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
  })
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

export function migrateAgendaDoc(input: unknown): PersistedDoc<AgendaState> {
  return migrateEnvelope(
    input,
    normalizeAgendaState,
    (o) => 'events' in o || 'weeklyAvailability' in o || 'categories' in o,
  )
}

export function mergeAgendaSafe(
  local: AgendaState,
  remote: AgendaState,
  preferRemote: boolean,
): AgendaState {
  const events = mergeById(
    local.events,
    remote.events,
    preferRemote,
  ).slice(0, 500) as AgendaEvent[]

  const catMap = new Map<string, AgendaState['categories'][number]>()
  const catsPrimary = preferRemote ? remote.categories : local.categories
  const catsSecondary = preferRemote ? local.categories : remote.categories
  for (const c of catsSecondary) catMap.set(c.id, c)
  for (const c of catsPrimary) catMap.set(c.id, c)

  const exceptions = mergeById(
    local.exceptions,
    remote.exceptions,
    preferRemote,
  ).slice(0, 200) as AvailabilityException[]

  const weekly =
    preferRemote && remote.weeklyAvailability.length === 7
      ? remote.weeklyAvailability
      : local.weeklyAvailability.length === 7
        ? local.weeklyAvailability
        : remote.weeklyAvailability

  return {
    events,
    categories: [...catMap.values()],
    weeklyAvailability: weekly,
    exceptions,
    sleepStart: preferRemote ? remote.sleepStart : local.sleepStart,
    sleepEnd: preferRemote ? remote.sleepEnd : local.sleepEnd,
  }
}
