import {
  Activity,
  BedDouble,
  ChevronRight,
  Droplets,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type {
  DailyCoachReport,
  DailyCoachSignal,
} from '../../lib/dailyCoach'

const SIGNAL_ICONS = {
  sleep: BedDouble,
  water: Droplets,
  energy: Activity,
  nutrition: UtensilsCrossed,
} satisfies Record<DailyCoachSignal['id'], typeof Activity>

export function DailyCoachCard({
  report,
  compact = false,
}: {
  report: DailyCoachReport
  compact?: boolean
}) {
  const visibleActions = compact ? report.actions.slice(0, 2) : report.actions

  return (
    <section
      className={`surface daily-coach daily-coach--${report.tone}${compact ? ' is-compact' : ''}`}
      aria-label="Orientação integrada do dia"
    >
      <header className="daily-coach__head">
        <span className="daily-coach__icon" aria-hidden>
          <Sparkles size={18} />
        </span>
        <div>
          <p className="page-kicker">VIDA conectado · prontidão {report.score}%</p>
          <h2>{report.title}</h2>
          <span>{report.summary}</span>
        </div>
      </header>

      <div className="daily-coach__signals" aria-label="Sinais considerados">
        {report.signals.map((signal) => {
          const Icon = SIGNAL_ICONS[signal.id]
          return (
            <div
              key={signal.id}
              className={`daily-coach__signal is-${signal.status}`}
            >
              <Icon size={14} aria-hidden />
              <span>
                <small>{signal.label}</small>
                <strong>{signal.value}</strong>
              </span>
            </div>
          )
        })}
      </div>

      {visibleActions.length > 0 && (
        <div className="daily-coach__actions">
          {visibleActions.map((action) => (
            <Link key={action.id} to={action.to} className="daily-coach__action">
              <span>{action.text}</span>
              <strong>
                {action.cta}
                <ChevronRight size={14} aria-hidden />
              </strong>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
