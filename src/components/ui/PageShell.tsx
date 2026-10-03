import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

const panelTransition = {
  duration: 0.35,
  ease: [0.22, 1, 0.36, 1] as const,
}

type PageHeaderProps = {
  kicker: string
  title: string
  sub?: string
  /** Quando definido, mostra Voltar em vez da action */
  onBack?: () => void
  action?: ReactNode
}

/** Cabeçalho padrão das páginas (lista ou ecrã de formulário). */
export function PageHeader({
  kicker,
  title,
  sub,
  onBack,
  action,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        <p className="page-kicker">{kicker}</p>
        <h1 className="page-title">{title}</h1>
        {sub ? <p className="page-sub">{sub}</p> : null}
      </div>
      {onBack ? (
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          <ChevronLeft size={16} />
          Voltar
        </button>
      ) : (
        action
      )}
    </header>
  )
}

type PanelScreenProps = {
  panelKey: string
  children: ReactNode
}

/** Ecrã completo para criar/editar — padrão do site. */
export function PanelScreen({ panelKey, children }: PanelScreenProps) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [panelKey])

  return (
    <motion.div
      key={panelKey}
      className="app-panel"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={panelTransition}
    >
      {children}
    </motion.div>
  )
}

type HomeScreenProps = {
  children: ReactNode
}

export function HomeScreen({ children }: HomeScreenProps) {
  return (
    <motion.div
      key="home"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={panelTransition}
    >
      {children}
    </motion.div>
  )
}

type PageScreensProps = {
  mode: 'home' | string
  home: ReactNode
  panel?: ReactNode
}

/** Alterna lista ↔ ecrã completo com animação. */
export function PageScreens({ mode, home, panel }: PageScreensProps) {
  return (
    <AnimatePresence mode="wait">
      {mode === 'home' || !panel ? (
        <HomeScreen>{home}</HomeScreen>
      ) : (
        <PanelScreen panelKey={mode}>{panel}</PanelScreen>
      )}
    </AnimatePresence>
  )
}
