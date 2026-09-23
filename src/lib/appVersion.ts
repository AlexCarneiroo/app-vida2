import { SCHEMA_VERSION } from './dataVersion'

/** Versão da app (sobe a cada commit/deploy). Não mexe nos dados. */
export const APP_VERSION = Number(
  import.meta.env.VITE_APP_RELEASE || '1',
) || 1

export const APP_VERSION_LABEL = `v${APP_VERSION}`

export function appVersionHint() {
  return `${APP_VERSION_LABEL} · dados ${SCHEMA_VERSION}`
}
