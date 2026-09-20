import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { PageTransition, staggerContainer, staggerItem } from '../components/ui/PageTransition'

type ModulePageProps = {
  kicker: string
  title: string
  subtitle: string
  glow: string
  icon: LucideIcon
  chips: string[]
  children?: ReactNode
}

export function ModulePage({
  kicker,
  title,
  subtitle,
  glow,
  icon: Icon,
  chips,
  children,
}: ModulePageProps) {
  return (
    <PageTransition>
      <header className="page-header">
        <div>
          <p className="page-kicker">{kicker}</p>
          <h1 className="page-title">{title}</h1>
          <p className="page-sub">{subtitle}</p>
        </div>
      </header>

      <motion.div
        className="surface placeholder-stage"
        style={{ '--glow': glow } as CSSProperties}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="placeholder-stage__glow" aria-hidden="true" />
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(var(--ink-rgb), 0.1)',
            marginBottom: '1rem',
            color: glow,
          }}
        >
          <Icon size={30} strokeWidth={2} />
        </motion.div>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: '1.6rem',
            letterSpacing: '-0.03em',
            position: 'relative',
          }}
        >
          Em breve, com profundidade
        </h2>
        <p
          style={{
            color: 'var(--ink-muted)',
            maxWidth: '40ch',
            marginTop: '0.4rem',
            position: 'relative',
          }}
        >
          A interface já está viva — a lógica deste módulo chega na próxima etapa.
        </p>
        <motion.div
          className="feature-chips"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          style={{ position: 'relative' }}
        >
          {chips.map((chip) => (
            <motion.span key={chip} className="chip" variants={staggerItem}>
              {chip}
            </motion.span>
          ))}
        </motion.div>
      </motion.div>

      {children}
    </PageTransition>
  )
}
