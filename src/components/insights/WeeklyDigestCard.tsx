import { CalendarRange } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CrossHighlight } from '../../lib/vidaReport'

function overlapsHighlight(text: string, highlights: string[]) {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const t = norm(text)
  return highlights.some((h) => {
    const n = norm(h)
    // Evita “Sono médio…” em destaque + “Sono médio… prioriza recuperação”
    const head = n.slice(0, 18)
    return t === n || (head.length >= 12 && t.startsWith(head))
  })
}

export function WeeklyDigestCard({
  label,
  highlights,
  crossLinks,
}: {
  label: string
  highlights: string[]
  crossLinks: CrossHighlight[]
}) {
  const lines = highlights.slice(0, 4)
  const link = crossLinks.find((c) => !overlapsHighlight(c.text, lines))

  if (lines.length === 0 && !link) return null

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
      {lines.length > 0 ? (
        <ul className="weekly-digest__list">
          {lines.map((line) => (
            <li key={line}>
              <CalendarRange size={14} aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {link ? (
        <Link to={link.to} className="weekly-digest__link">
          {link.text}
        </Link>
      ) : null}
    </section>
  )
}
