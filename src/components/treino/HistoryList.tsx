import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { formatKg } from '../../lib/date'
import { workoutSetsDone, workoutVolume } from '../../lib/treinoStats'
import type { ActiveWorkout } from '../../types/treino'

type HistoryListProps = {
  history: ActiveWorkout[]
  limit?: number
}

export function HistoryList({ history, limit = 8 }: HistoryListProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const items = history.slice(0, limit)

  if (items.length === 0) return null

  return (
    <div className="treino-history">
      {items.map((w) => {
        const open = openId === w.startedAt
        const setsDone = workoutSetsDone(w)
        const volume = Math.round(workoutVolume(w))
        return (
          <div
            key={w.startedAt}
            className={`surface treino-history-row${open ? ' is-open' : ''}`}
          >
            <button
              type="button"
              className="treino-history-row__btn"
              onClick={() => setOpenId(open ? null : w.startedAt)}
              aria-expanded={open}
            >
              <div>
                <strong>{w.name}</strong>
                <span>
                  {w.dateKey} · {volume} kg vol.
                </span>
              </div>
              <em>{setsDone} séries</em>
              <ChevronDown
                size={16}
                className={`treino-ex__chevron${open ? ' is-open' : ''}`}
              />
            </button>

            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  className="treino-history-detail"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  {w.exercises.map((ex) => {
                    const done = ex.sets.filter((s) => s.done)
                    if (done.length === 0) return null
                    return (
                      <div key={ex.id} className="treino-history-detail__ex">
                        <strong>{ex.name}</strong>
                        <ul>
                          {done.map((s, i) => (
                            <li key={s.id}>
                              S{i + 1}: {s.reps} reps · {formatKg(s.weight)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
