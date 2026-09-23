import { loadJson, saveJson } from './storage'

export type NavPageId =
  | 'home'
  | 'treino'
  | 'financas'
  | 'habitos'
  | 'rotina'
  | 'relatorio'
  | 'config'

export type NavPage = {
  id: NavPageId
  to: string
  label: string
  end?: boolean
}

export const NAV_PAGES: NavPage[] = [
  { id: 'home', to: '/', label: 'Início', end: true },
  { id: 'treino', to: '/treino', label: 'Treino' },
  { id: 'financas', to: '/financas', label: 'Finanças' },
  { id: 'habitos', to: '/habitos', label: 'Hábitos' },
  { id: 'rotina', to: '/rotina', label: 'Rotina' },
  { id: 'relatorio', to: '/relatorio', label: 'Relatório' },
  { id: 'config', to: '/config', label: 'Conta' },
]

export const DEFAULT_NAV_FAVORITES: NavPageId[] = [
  'home',
  'treino',
  'financas',
  'habitos',
]

export const MAX_NAV_FAVORITES = 4
export const MIN_NAV_FAVORITES = 2

const STORAGE_KEY = 'vida.nav.v1'

type NavPrefs = {
  favoriteIds: NavPageId[]
}

function isNavPageId(value: unknown): value is NavPageId {
  return NAV_PAGES.some((p) => p.id === value)
}

export function loadNavFavorites(): NavPageId[] {
  const raw = loadJson<NavPrefs>(STORAGE_KEY, {
    favoriteIds: DEFAULT_NAV_FAVORITES,
  })
  const ids = (raw.favoriteIds ?? []).filter(isNavPageId)
  const unique = NAV_PAGES.map((p) => p.id).filter((id) => ids.includes(id))
  if (unique.length < MIN_NAV_FAVORITES) return [...DEFAULT_NAV_FAVORITES]
  return unique.slice(0, MAX_NAV_FAVORITES)
}

export function saveNavFavorites(ids: NavPageId[]) {
  saveJson(STORAGE_KEY, { favoriteIds: ids })
}

export function pagesByIds(ids: NavPageId[]) {
  return ids
    .map((id) => NAV_PAGES.find((p) => p.id === id))
    .filter((p): p is NavPage => Boolean(p))
}
