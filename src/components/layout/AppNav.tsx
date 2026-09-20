import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Dumbbell,
  LayoutDashboard,
  PiggyBank,
  Repeat,
  Settings,
  Sparkles,
} from 'lucide-react'

const links: {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
}[] = [
  { to: '/', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/treino', label: 'Treino', icon: Dumbbell },
  { to: '/financas', label: 'Finanças', icon: PiggyBank },
  { to: '/habitos', label: 'Hábitos', icon: Sparkles },
  { to: '/rotina', label: 'Rotina', icon: Repeat },
  { to: '/config', label: 'Conta', icon: Settings },
]

type AppNavProps = {
  variant: 'bottom' | 'side'
}

export function AppNav({ variant }: AppNavProps) {
  return (
    <nav
      className={`app-nav app-nav--${variant}`}
      aria-label="Navegação principal"
    >
      {variant === 'side' && (
        <div className="nav-brand" aria-label="VIDA">
          V
        </div>
      )}
      {links.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `nav-item${isActive ? ' is-active' : ''}`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId={`nav-pill-${variant}`}
                  className="nav-item__pill"
                  transition={{ type: 'spring', stiffness: 520, damping: 36, mass: 0.6 }}
                />
              )}
              <span className="nav-item__icon">
                <Icon size={20} strokeWidth={isActive ? 2.4 : 1.9} />
              </span>
              <span className="nav-item__label">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
