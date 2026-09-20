import {
  emptyHabitosState,
  normalizeHabit,
  normalizePersonalGoal,
} from '../data/habitosDefaults'
import { emptyRotinaState } from '../data/rotinaDefaults'
import { normalizeExerciseName } from './treinoStats'
import {
  SCHEMA_VERSION,
  isPersistedDoc,
  wrapDoc,
  type PersistedDoc,
} from './dataVersion'
import type { FinancasState, SavingsGoal, Transaction } from '../types/financas'
import type { Habit, HabitosState, PersonalGoal } from '../types/habitos'
import type { RotinaState, RoutineBlock } from '../types/rotina'
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

  return {
    transactions,
    goals,
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

  return {
    transactions: [...txMap.values()],
    goals: [...goalMap.values()],
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
