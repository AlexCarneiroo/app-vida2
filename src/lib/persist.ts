import {
  migrateFinancasDoc,
  migrateHabitosDoc,
  migrateRotinaDoc,
  migrateTreinoDoc,
} from './migrate'
import {
  SCHEMA_VERSION,
  wrapDoc,
  type PersistedDoc,
} from './dataVersion'
import type { FinancasState } from '../types/financas'
import type { HabitosState } from '../types/habitos'
import type { RotinaState } from '../types/rotina'
import type { TreinoState } from '../types/treino'

const BACKUP_PREFIX = 'vida.backup.'

function backupRaw(key: string, raw: string) {
  try {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    localStorage.setItem(`${BACKUP_PREFIX}${key}.${stamp}`, raw)
    const keys = Object.keys(localStorage)
      .filter((k) => k.startsWith(`${BACKUP_PREFIX}${key}.`))
      .sort()
    while (keys.length > 3) {
      const old = keys.shift()
      if (old) localStorage.removeItem(old)
    }
  } catch {
    // quota
  }
}

function loadWithMigrate<T>(
  key: string,
  fallback: T,
  migrate: (raw: unknown) => PersistedDoc<T>,
): PersistedDoc<T> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return wrapDoc(fallback, 0)
    const parsed = JSON.parse(raw) as unknown
    const migrated = migrate(parsed)
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('schemaVersion' in (parsed as object)) ||
      (parsed as PersistedDoc<unknown>).schemaVersion !== SCHEMA_VERSION
    ) {
      backupRaw(key, raw)
      savePersisted(key, migrated)
    }
    return migrated
  } catch {
    return wrapDoc(fallback, 0)
  }
}

export function loadTreinoPersisted(key: string, fallback: TreinoState) {
  return loadWithMigrate(key, fallback, migrateTreinoDoc)
}

export function loadFinancasPersisted(key: string, fallback: FinancasState) {
  return loadWithMigrate(key, fallback, migrateFinancasDoc)
}

export function loadHabitosPersisted(key: string, fallback: HabitosState) {
  return loadWithMigrate(key, fallback, migrateHabitosDoc)
}

export function loadRotinaPersisted(key: string, fallback: RotinaState) {
  return loadWithMigrate(key, fallback, migrateRotinaDoc)
}

export function savePersisted<T>(key: string, doc: PersistedDoc<T>) {
  try {
    const payload: PersistedDoc<T> = {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: doc.updatedAt || Date.now(),
      data: doc.data,
    }
    localStorage.setItem(key, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export function touchPersisted<T>(
  key: string,
  data: T,
  updatedAt = Date.now(),
): PersistedDoc<T> {
  const doc = wrapDoc(data, updatedAt)
  savePersisted(key, doc)
  return doc
}
