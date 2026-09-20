import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ThemeMode = 'dark' | 'light'

export type AccentId =
  | 'jade'
  | 'ocean'
  | 'azul'
  | 'coral'
  | 'ambar'
  | 'violeta'

export const ACCENT_OPTIONS: Array<{
  id: AccentId
  label: string
  swatch: string
}> = [
  { id: 'jade', label: 'Jade', swatch: '#2dd4a8' },
  { id: 'ocean', label: 'Oceano', swatch: '#38bdf8' },
  { id: 'azul', label: 'Azul', swatch: '#60a5fa' },
  { id: 'coral', label: 'Coral', swatch: '#fb7185' },
  { id: 'ambar', label: 'Âmbar', swatch: '#fbbf24' },
  { id: 'violeta', label: 'Violeta', swatch: '#a78bfa' },
]

const THEME_KEY = 'vida.theme'
const ACCENT_KEY = 'vida.accent'

type ThemeContextValue = {
  theme: ThemeMode
  accent: AccentId
  setTheme: (mode: ThemeMode) => void
  setAccent: (accent: AccentId) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const THEME_COLORS: Record<ThemeMode, Record<AccentId, string>> = {
  dark: {
    jade: '#0a3d3a',
    ocean: '#0b2a3a',
    azul: '#0f1f3a',
    coral: '#3a1520',
    ambar: '#3a2a0e',
    violeta: '#22153a',
  },
  light: {
    jade: '#f4f7f6',
    ocean: '#f3f8fb',
    azul: '#f3f6fb',
    coral: '#fbf4f5',
    ambar: '#fbf8f1',
    violeta: '#f7f4fb',
  },
}

export function readStoredTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    if (raw === 'light' || raw === 'dark') return raw
  } catch {
    /* ignore */
  }
  return 'dark'
}

export function readStoredAccent(): AccentId {
  try {
    const raw = localStorage.getItem(ACCENT_KEY)
    if (ACCENT_OPTIONS.some((o) => o.id === raw)) return raw as AccentId
  } catch {
    /* ignore */
  }
  return 'jade'
}

export function applyTheme(mode: ThemeMode, accent: AccentId = readStoredAccent()) {
  const root = document.documentElement
  root.setAttribute('data-theme', mode)
  root.setAttribute('data-accent', accent)
  root.style.colorScheme = mode

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLORS[mode][accent])

  const statusBar = document.querySelector(
    'meta[name="apple-mobile-web-app-status-bar-style"]',
  )
  if (statusBar) {
    statusBar.setAttribute(
      'content',
      mode === 'light' ? 'default' : 'black-translucent',
    )
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const initialTheme = readStoredTheme()
    const initialAccent = readStoredAccent()
    applyTheme(initialTheme, initialAccent)
    return initialTheme
  })
  const [accent, setAccentState] = useState<AccentId>(() => readStoredAccent())

  useEffect(() => {
    applyTheme(theme, accent)
    try {
      localStorage.setItem(THEME_KEY, theme)
      localStorage.setItem(ACCENT_KEY, accent)
    } catch {
      /* ignore */
    }
  }, [theme, accent])

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode)
  }, [])

  const setAccent = useCallback((next: AccentId) => {
    setAccentState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const value = useMemo(
    () => ({ theme, accent, setTheme, setAccent, toggleTheme }),
    [theme, accent, setTheme, setAccent, toggleTheme],
  )

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme deve ser usado dentro de ThemeProvider')
  }
  return ctx
}
