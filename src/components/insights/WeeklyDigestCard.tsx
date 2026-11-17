import { CalendarRange } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CrossHighlight } from '../../lib/vidaReport'

export function WeeklyDigestCard({
  label,
  highlights,
  crossLinks,
}: {
  label: string
  highlights: string[]
  crossLinks: CrossHighlight[]
}) {
  const lines = [
    ...highlights.slice(0, 3),
    ...crossLinks.map((c) => c.text).slice(0, 2),
  ].slice(0, 4)

  if (lines.length === 0) return null

  return (
    <section className="surface weekly-digest" aria-label="Resumo semanal">
      <div className="weekly-digest__head">
        <div>
          <p className="page-kicker">A tua semana</p>
          <strong>{label}</strong>
        </div>
        <Link to="/relatorio?range=week" className="btn btn--ghost">
          Ver relatório
        </Link>
      </div>
      <ul className="weekly-digest__list">
        {lines.map((line) => (
          <li key={line}>
            <CalendarRange size={14} aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      {crossLinks[0] ? (
        <Link to={crossLinks[0].to} className="weekly-digest__link">
          {crossLinks[0].text}
        </Link>
      ) : null}
    </section>
  )
}
