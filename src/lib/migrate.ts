import { emptyHabitosState } from '../data/habitosDefaults'
import { emptyRotinaState } from '../data/rotinaDefaults'
import { normalizeExerciseName } from './treinoStats'
import {
  SCHEMA_VERSION,
  isPersistedDoc,
  wrapDoc,
  type PersistedDoc,
} from './dataVersion'
import type { FinancasState, SavingsGoal, Transaction } from '../types/financas'
import type { Habit, HabitosState } from '../types/habitos'
import type { RotinaState, RoutineBlock } from '../types/rotina'
import type {
  ActiveWorkout,
  Exercise,
  TreinoSettings,
  TreinoState,
  WorkoutTemplate,
} from '../types/treino'

const defaultSettings: TreinoSettings = { restSeconds: 90 }

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
    },
    activePresetId:
      parsed.activePresetId === undefined ? null : parsed.activePresetId,
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
  })
}

export function normalizeHabitos(raw: unknown): HabitosState {
  const parsed = (raw && typeof raw === 'object' ? raw : {}) as Partial<HabitosState>
  const habits = asArray<Habit>(parsed.habits)
    .filter((h) => h && typeof h.id === 'string')
    .map((h) => ({
      id: h.id,
      name: h.name?.trim() || 'Hábito',
      detail: h.detail ?? '',
      streak: Math.max(0, Number(h.streak) || 0),
      doneToday: Boolean(h.doneToday),
      lastDoneDateKey: h.lastDoneDateKey ?? null,
      createdAt: h.createdAt || new Date().toISOString(),
    }))
  const base = emptyHabitosState()
  return {
    dayKey: parsed.dayKey || base.dayKey,
    habits,
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
  return {
    dayKey: parsed.dayKey || base.dayKey,
    blocks,
  }
}

function migrateEnvelope<T>(
  input: unknown,
  normalize: (raw: unknown) => T,
  looksLikeData: (obj: object) => boolean,
): PersistedDoc<T> {
  if (isPersistedDoc(input)) {
    return {
      schemaVersion: SCHEMA_VERSION,
      updatedAt:
        typeof input.updatedAt === 'number' && input.updatedAt > 0
          ? input.updatedAt
          : Date.now(),
      data: normalize(input.data),
    }
  }
  if (
    input &&
    typeof input === 'object' &&
    'data' in input &&
    !looksLikeData(input)
  ) {
    const env = input as { data: unknown; updatedAt?: number }
    return {
      schemaVersion: SCHEMA_VERSION,
      updatedAt:
        typeof env.updatedAt === 'number' && env.updatedAt > 0
          ? env.updatedAt
          : Date.now(),
      data: normalize(env.data),
    }
  }
  return wrapDoc(normalize(input))
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
  const first = preferRemote ? remote.habits : local.habits
  const second = preferRemote ? local.habits : remote.habits
  for (const h of first) map.set(h.id, h)
  for (const h of second) {
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
      lastDoneDateKey: preferRemote
        ? h.lastDoneDateKey ?? prev.lastDoneDateKey
        : prev.lastDoneDateKey ?? h.lastDoneDateKey,
    })
  }
  return {
    dayKey: preferRemote
      ? remote.dayKey || local.dayKey
      : local.dayKey || remote.dayKey,
    habits: [...map.values()],
  }
}

export function mergeRotinaSafe(
  local: RotinaState,
  remote: RotinaState,
  preferRemote: boolean,
): RotinaState {
  const map = new Map<string, RoutineBlock>()
  const first = preferRemote ? remote.blocks : local.blocks
  const second = preferRemote ? local.blocks : remote.blocks
  for (const b of first) map.set(b.id, b)
  for (const b of second) {
    if (!map.has(b.id)) map.set(b.id, b)
  }
  return {
    dayKey: preferRemote ? remote.dayKey || local.dayKey : local.dayKey || remote.dayKey,
    blocks: [...map.values()].sort((a, b) => a.time.localeCompare(b.time)),
  }
}
