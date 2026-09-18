/** Versão do esquema de dados da app. Sobe só quando a forma dos dados muda. */
export const SCHEMA_VERSION = 1

export type PersistedDoc<T> = {
  schemaVersion: number
  updatedAt: number
  data: T
}

export type CloudCollection = 'treino' | 'financas' | 'habitos' | 'rotina'

export function isPersistedDoc(value: unknown): value is PersistedDoc<unknown> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'schemaVersion' in value &&
      'data' in value &&
      typeof (value as PersistedDoc<unknown>).schemaVersion === 'number',
  )
}

export function wrapDoc<T>(data: T, updatedAt = Date.now()): PersistedDoc<T> {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt,
    data,
  }
}
