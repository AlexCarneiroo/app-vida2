import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  FlaskConical,
  HeartPulse,
  Moon,
  Scale,
} from 'lucide-react'

export type SaudeTabId = 'visao' | 'sono' | 'corpo' | 'exames' | 'cuidado'

const TABS: { id: SaudeTabId; label: string; icon: LucideIcon }[] = [
  { id: 'visao', label: 'Visão', icon: HeartPulse },
  { id: 'sono', label: 'Sono', icon: Moon },
  { id: 'corpo', label: 'Corpo', icon: Scale },
  { id: 'exames', label: 'Exames', icon: FlaskConical },
  { id: 'cuidado', label: 'Cuidado', icon: Activity },
]

export function SaudeTabNav({
  active,
  onChange,
}: {
  active: SaudeTabId
  onChange: (id: SaudeTabId) => void
}) {
  return (
    <nav
      className="config-section-tabs saude-section-tabs"
      role="tablist"
      aria-label="Secções de saúde"
    >
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          className={active === id ? 'is-active' : undefined}
          onClick={() => onChange(id)}
        >
          <Icon size={16} />
          {label}
        </button>
      ))}
    </nav>
  )
}
