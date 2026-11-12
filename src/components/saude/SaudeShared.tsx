import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Button } from '../ui/Button'
import { staggerItem } from '../ui/PageTransition'
import type { SleepQuality } from '../../types/saude'

export const QUALITY: SleepQuality[] = [1, 2, 3, 4, 5]

export function SignalCard({
  icon,
  title,
  text,
  ok,
  action,
}: {
  icon: ReactNode
  title: string
  text: string
  ok?: boolean
  action: ReactNode
}) {
  return (
    <motion.article
      className={`surface saude-signal${ok ? ' is-ok' : ''}`}
      variants={staggerItem}
    >
      {icon}
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
      <span className="saude-signal__link">{action}</span>
    </motion.article>
  )
}

export function QualityField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: SleepQuality
  onChange: (q: SleepQuality) => void
  hint?: string
}) {
  return (
    <fieldset className="saude-sex">
      <legend>{label}</legend>
      {hint ? <p className="saude-field-hint">{hint}</p> : null}
      <div className="habit-chips">
        {QUALITY.map((q) => (
          <button
            key={q}
            type="button"
            className={`habit-chip${value === q ? ' is-active' : ''}`}
            onClick={() => onChange(q)}
          >
            {q}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function PanelActions({
  onCancel,
  label = 'Guardar',
}: {
  onCancel: () => void
  label?: string
}) {
  return (
    <div className="habit-form__actions">
      <button type="button" className="btn btn--ghost" onClick={onCancel}>
        Cancelar
      </button>
      <Button type="submit" variant="primary">
        {label}
      </Button>
    </div>
  )
}

export function sparkPoints(values: number[]): string | null {
  if (values.length < 2) return null
  const w = 120
  const h = 36
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / span) * (h - 4) - 2
      return `${x},${y}`
    })
    .join(' ')
}

export function Sparkline({
  points,
  className,
}: {
  points: string
  className?: string
}) {
  return (
    <svg
      className={className ?? 'saude-spark'}
      viewBox="0 0 120 36"
      width="100%"
      height={36}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

export function InsightList({
  items,
}: {
  items: { id: string; tone: string; title: string; body: string }[]
}) {
  if (items.length === 0) return null
  return (
    <ul className="saude-insights">
      {items.map((ins) => (
        <li key={ins.id} className={`saude-insight is-${ins.tone}`}>
          <strong>{ins.title}</strong>
          <p>{ins.body}</p>
        </li>
      ))}
    </ul>
  )
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <article className="surface saude-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <em>{hint}</em> : null}
    </article>
  )
}
