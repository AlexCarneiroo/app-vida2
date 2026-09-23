import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_NAV_FAVORITES,
  loadNavFavorites,
  MAX_NAV_FAVORITES,
  MIN_NAV_FAVORITES,
  NAV_PAGES,
  pagesByIds,
  saveNavFavorites,
  type NavPageId,
} from '../lib/navPrefs'

type NavPrefsApi = {
  favoriteIds: NavPageId[]
  favorites: ReturnType<typeof pagesByIds>
  more: ReturnType<typeof pagesByIds>
  toggleFavorite: (id: NavPageId) => { ok: boolean; message?: string }
  resetFavorites: () => void
}

const NavPrefsContext = createContext<NavPrefsApi | null>(null)

export function NavPrefsProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<NavPageId[]>(loadNavFavorites)

  const persist = useCallback((ids: NavPageId[]) => {
    const ordered = NAV_PAGES.map((p) => p.id).filter((id) => ids.includes(id))
    setFavoriteIds(ordered)
    saveNavFavorites(ordered)
  }, [])

  const toggleFavorite = useCallback(
    (id: NavPageId) => {
      if (favoriteIds.includes(id)) {
        if (favoriteIds.length <= MIN_NAV_FAVORITES) {
          return {
            ok: false,
            message: `Mantém pelo menos ${MIN_NAV_FAVORITES} atalhos na barra.`,
          }
        }
        persist(favoriteIds.filter((x) => x !== id))
        return { ok: true }
      }
      if (favoriteIds.length >= MAX_NAV_FAVORITES) {
        return {
          ok: false,
          message: `A barra leva no máximo ${MAX_NAV_FAVORITES} atalhos. Tira um para pôr outro.`,
        }
      }
      persist([...favoriteIds, id])
      return { ok: true }
    },
    [favoriteIds, persist],
  )

  const resetFavorites = useCallback(() => {
    persist([...DEFAULT_NAV_FAVORITES])
  }, [persist])

  const value = useMemo<NavPrefsApi>(() => {
    const moreIds = NAV_PAGES.map((p) => p.id).filter(
      (id) => !favoriteIds.includes(id),
    )
    return {
      favoriteIds,
      favorites: pagesByIds(favoriteIds),
      more: pagesByIds(moreIds),
      toggleFavorite,
      resetFavorites,
    }
  }, [favoriteIds, resetFavorites, toggleFavorite])

  return (
    <NavPrefsContext.Provider value={value}>{children}</NavPrefsContext.Provider>
  )
}

export function useNavPrefs() {
  const ctx = useContext(NavPrefsContext)
  if (!ctx) {
    throw new Error('useNavPrefs precisa de NavPrefsProvider')
  }
  return ctx
}
