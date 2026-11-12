import { SCHEMA_VERSION } from './dataVersion'

/** Versão semântica (package.json) — o que aparece nas Configurações. */
export const APP_PACKAGE_VERSION =
  String(import.meta.env.VITE_APP_VERSION || '0.0.0').trim() || '0.0.0'

/** Build monotónico (contagem de commits), só informativo. */
export const APP_BUILD = Number(import.meta.env.VITE_APP_RELEASE || '0') || 0

export const APP_VERSION_LABEL = APP_PACKAGE_VERSION

export function appVersionHint() {
  const build = APP_BUILD > 0 ? ` · build ${APP_BUILD}` : ''
  return `${APP_PACKAGE_VERSION}${build} · dados ${SCHEMA_VERSION}`
}
