import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3,
  Dumbbell,
  LayoutDashboard,
  PiggyBank,
  Plus,
  Repeat,
  Settings,
  Sparkles,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavPrefs } from '../../hooks/useNavPrefs'
import type { NavPage, NavPageId } from '../../lib/navPrefs'

const ICONS: Record<NavPageId, typeof LayoutDashboard> = {
  home: LayoutDashboard,
  treino: Dumbbell,
  financas: PiggyBank,
  habitos: Sparkles,
  rotina: Repeat,
  nutricao: UtensilsCrossed,
  relatorio: BarChart3,
  config: Settings,
}

type AppNavProps = {
  variant: 'bottom' | 'side'
}

function NavItem({
  page,
  variant,
}: {
  page: NavPage
  variant: 'bottom' | 'side'
}) {
  const Icon = ICONS[page.id]
  return (
    <NavLink
      to={page.to}
      end={page.end}
      className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId={`nav-pill-${variant}`}
              className="nav-item__pill"
              transition={{
                type: 'spring',
                stiffness: 520,
                damping: 36,
                mass: 0.6,
              }}
            />
          )}
          <span className="nav-item__icon">
            <Icon size={20} strokeWidth={isActive ? 2.4 : 1.9} />
          </span>
          <span className="nav-item__label">{page.label}</span>
        </>
      )}
    </NavLink>
  )
}

export function AppNav({ variant }: AppNavProps) {
  const { favorites, more } = useNavPrefs()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const moreActive = more.some((p) =>
    p.end ? location.pathname === p.to : location.pathname.startsWith(p.to),
  )

  const mid = Math.ceil(favorites.length / 2)
  const left = favorites.slice(0, mid)
  const right = favorites.slice(mid)

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  return (
    <>
      <nav
        className={`app-nav app-nav--${variant}`}
        aria-label="Navegação principal"
      >
        {variant === 'side' && (
          <div className="nav-brand" aria-label="VIDA">
            V
          </div>
        )}

        {left.map((page) => (
          <NavItem key={page.id} page={page} variant={variant} />
        ))}

        <button
          type="button"
          className={`nav-item nav-item--plus${moreActive || open ? ' is-active' : ''}`}
          aria-label="Mais secções"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="nav-item__icon nav-item__icon--plus">
            {open ? <X size={20} strokeWidth={2.4} /> : <Plus size={22} strokeWidth={2.4} />}
          </span>
          <span className="nav-item__label">Mais</span>
        </button>

        {right.map((page) => (
          <NavItem key={page.id} page={page} variant={variant} />
        ))}
      </nav>

      <AnimatePresence>
        {open && (
          <div className={`nav-more nav-more--${variant}`}>
            <motion.button
              type="button"
              className="nav-more-backdrop"
              aria-label="Fechar"
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="nav-more-sheet"
              role="dialog"
              aria-label="Outras secções"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="nav-more-sheet__title">Ir para</p>
              <div className="nav-more-sheet__grid">
                {more.map((page) => {
                  const Icon = ICONS[page.id]
                  const active = page.end
                    ? location.pathname === page.to
                    : location.pathname.startsWith(page.to)
                  return (
                    <button
                      key={page.id}
                      type="button"
                      className={`nav-more-sheet__btn${active ? ' is-active' : ''}`}
                      onClick={() => {
                        setOpen(false)
                        navigate(page.to)
                      }}
                    >
                      <span className="nav-more-sheet__icon">
                        <Icon size={20} />
                      </span>
                      {page.label}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                className="nav-more-sheet__edit"
                onClick={() => {
                  setOpen(false)
                  navigate('/config')
                }}
              >
                Editar atalhos da barra
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
