import { motion } from 'framer-motion'
import { Trophy, X } from 'lucide-react'
import { formatKg } from '../../lib/date'
import type { WorkoutSummary } from '../../types/treino'

type WorkoutSummaryCardProps = {
  summary: WorkoutSummary
  onClose: () => void
}

export function WorkoutSummaryCard({
  summary,
  onClose,
}: WorkoutSummaryCardProps) {
  return (
    <motion.div
      className="surface workout-summary"
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="workout-summary__head">
        <div className="workout-summary__icon">
          <Trophy size={22} />
        </div>
        <div>
          <p className="page-kicker">Sessão concluída</p>
          <h2>{summary.name}</h2>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X size={16} />
        </button>
      </div>

      <div className="workout-summary__grid">
        <div>
          <span>Duração</span>
          <strong>{summary.durationMin} min</strong>
        </div>
        <div>
          <span>Volume</span>
          <strong>{Math.round(summary.volume)} kg</strong>
        </div>
        <div>
          <span>Séries</span>
          <strong>
            {summary.setsDone}/{summary.totalSets}
          </strong>
        </div>
        <div>
          <span>vs anterior</span>
          <strong>
            {summary.volumeDelta === null
              ? '—'
              : `${summary.volumeDelta > 0 ? '+' : ''}${summary.volumeDelta} kg`}
          </strong>
        </div>
      </div>

      {summary.prs.length > 0 && (
        <div className="workout-summary__prs">
          <p className="page-kicker">Recordes pessoais</p>
          <ul>
            {summary.prs.map((pr) => (
              <li key={pr.exerciseName}>
                <strong>{pr.exerciseName}</strong>
                <span>
                  {formatKg(pr.weight)}
                  {pr.previousBest > 0
                    ? ` · era ${formatKg(pr.previousBest)}`
                    : ' · primeiro registo'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button type="button" className="btn btn--primary" onClick={onClose}>
        Continuar
      </button>
    </motion.div>
  )
}
