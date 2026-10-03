import { Gauge } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { EffortLevel } from '../../types/treino'

type InstructorEffortSheetProps = {
  exerciseName: string
  lastWeight: number | null
  quickMode: boolean
  onPick: (effort: EffortLevel) => void
  onSkip: () => void
}

const OPTIONS: Array<{
  id: EffortLevel
  label: string
  hint: string
  className: string
}> = [
  {
    id: 'light',
    label: 'Leve',
    hint: 'Subir carga',
    className: 'is-light',
  },
  {
    id: 'moderate',
    label: 'Médio',
    hint: 'Manter',
    className: 'is-mid',
  },
  {
    id: 'hard',
    label: 'Pesado',
    hint: 'Baixar carga',
    className: 'is-hard',
  },
]

export function InstructorEffortSheet({
  exerciseName,
  lastWeight,
  quickMode,
  onPick,
  onSkip,
}: InstructorEffortSheetProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div
      className="instructor-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="instructor-sheet-title"
    >
      <button
        type="button"
        className="instructor-sheet__backdrop"
        aria-label="Ignorar"
        onClick={onSkip}
      />
      <div className="instructor-sheet__card">
        <div className="instructor-sheet__handle" aria-hidden />
        <div className="instructor-sheet__head">
          <span className="instructor-sheet__icon" aria-hidden>
            <Gauge size={18} />
          </span>
          <div>
            <p className="page-kicker">
              Modo instrutor{quickMode ? ' · rápido' : ''}
            </p>
            <h2 id="instructor-sheet-title">Como foi a série?</h2>
            <p>
              <strong>{exerciseName}</strong>
              {' — ajustamos as próximas.'}
            </p>
            {lastWeight != null && lastWeight > 0 && (
              <p className="instructor-sheet__last">
                Última sessão: <strong>{lastWeight} kg</strong>
              </p>
            )}
          </div>
        </div>

        <div className="instructor-sheet__options" role="group">
          {OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`instructor-sheet__opt ${opt.className}`}
              onClick={() => onPick(opt.id)}
            >
              <strong>{opt.label}</strong>
              <span>{opt.hint}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="instructor-sheet__skip"
          onClick={onSkip}
        >
          Ignorar desta vez
        </button>
      </div>
    </div>,
    document.body,
  )
}
