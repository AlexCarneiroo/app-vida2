import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { useState } from 'react'
import { formatKg } from '../../lib/date'
import type { ExerciseProgress } from '../../types/treino'

type ProgressionPanelProps = {
  items: ExerciseProgress[]
}

export function ProgressionPanel({ items }: ProgressionPanelProps) {
  const [open, setOpen] = useState<string | null>(null)

  if (items.length === 0) {
    return (
      <div className="surface treino-progress-empty">
        <p>Conclui treinos para ver a evolução de carga por exercício.</p>
      </div>
    )
  }

  return (
    <div className="treino-progress">
      {items.map((item) => {
        const isOpen = open === item.key
        const TrendIcon =
          item.delta > 0 ? TrendingUp : item.delta < 0 ? TrendingDown : Minus
        const deltaLabel =
          item.delta === 0
            ? 'estável'
            : `${item.delta > 0 ? '+' : ''}${item.delta} kg`

        return (
          <div
            key={item.key}
            className={`surface treino-progress-row${isOpen ? ' is-open' : ''}`}
          >
            <button
              type="button"
              className="treino-progress-row__head"
              onClick={() => setOpen(isOpen ? null : item.key)}
              aria-expanded={isOpen}
            >
              <span className="treino-progress-row__info">
                <strong>{item.name}</strong>
                <span>{item.muscle}</span>
              </span>
              <span className="treino-progress-row__stats">
                <em>{formatKg(item.lastWeight)}</em>
                <span
                  className={`treino-progress-delta${
                    item.delta > 0
                      ? ' is-up'
                      : item.delta < 0
                        ? ' is-down'
                        : ''
                  }`}
                >
                  <TrendIcon size={13} />
                  {deltaLabel}
                </span>
              </span>
              <ChevronDown
                size={16}
                className={`treino-ex__chevron${isOpen ? ' is-open' : ''}`}
              />
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="treino-progress-row__body"
                >
                  <p className="treino-progress-best">
                    Recorde: <strong>{formatKg(item.bestWeight)}</strong>
                  </p>
                  <ul className="treino-progress-sessions">
                    {item.sessions.slice(0, 8).map((s, i) => (
                      <li key={`${s.dateKey}-${i}`}>
                        <span>
                          <strong>{s.dateKey}</strong>
                          <em>{s.workoutName}</em>
                        </span>
                        <span>
                          {s.bestSet} · {s.setsDone} séries ·{' '}
                          {Math.round(s.volume)} kg vol.
                        </span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
