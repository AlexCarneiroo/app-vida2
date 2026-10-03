import { useMemo, useState, type FormEvent } from 'react'
import {
  MUSCLE_LABELS,
  defaultExerciseName,
  exercisesForMuscle,
} from '../../data/exerciseLibrary'
import type { MuscleGroup } from '../../types/treino'
import { Button } from '../ui/Button'

const MUSCLES = Object.keys(MUSCLE_LABELS) as MuscleGroup[]

export type ExercisePickerValue = {
  name: string
  muscle: MuscleGroup
}

type ExercisePickerSheetProps = {
  title: string
  confirmLabel: string
  initial?: Partial<ExercisePickerValue>
  onConfirm: (value: ExercisePickerValue) => void
  onCancel: () => void
}

export function ExercisePickerSheet({
  title,
  confirmLabel,
  initial,
  onConfirm,
  onCancel,
}: ExercisePickerSheetProps) {
  const [muscle, setMuscle] = useState<MuscleGroup>(initial?.muscle ?? 'peito')
  const library = useMemo(() => exercisesForMuscle(muscle), [muscle])
  const initialInLibrary =
    initial?.name && library.includes(initial.name) ? initial.name : library[0]
  const [nameChoice, setNameChoice] = useState(
    initial?.name && !library.includes(initial.name)
      ? '__other__'
      : (initialInLibrary ?? defaultExerciseName(muscle)),
  )
  const [customName, setCustomName] = useState(
    initial?.name && !library.includes(initial.name) ? initial.name : '',
  )

  function handleMuscle(next: MuscleGroup) {
    setMuscle(next)
    const list = exercisesForMuscle(next)
    setNameChoice(list[0] ?? defaultExerciseName(next))
    setCustomName('')
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const name =
      nameChoice === '__other__'
        ? customName.trim()
        : nameChoice.trim() || defaultExerciseName(muscle)
    if (!name) return
    onConfirm({ name, muscle })
  }

  return (
    <div className="app-confirm">
      <button
        type="button"
        className="app-confirm__backdrop"
        aria-label="Fechar"
        onClick={onCancel}
      />
      <form
        className="surface app-confirm__card exercise-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-picker-title"
        onSubmit={handleSubmit}
      >
        <h2 id="exercise-picker-title">{title}</h2>
        <p>Escolhe o grupo e o movimento (ou escreve o nome).</p>

        <label className="exercise-picker__field">
          <span>Grupo</span>
          <select
            value={muscle}
            onChange={(e) => handleMuscle(e.target.value as MuscleGroup)}
          >
            {MUSCLES.map((m) => (
              <option key={m} value={m}>
                {MUSCLE_LABELS[m]}
              </option>
            ))}
          </select>
        </label>

        <label className="exercise-picker__field">
          <span>Exercício</span>
          <select
            value={nameChoice}
            onChange={(e) => setNameChoice(e.target.value)}
          >
            {library.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value="__other__">Outro (escrever)…</option>
          </select>
        </label>

        {nameChoice === '__other__' && (
          <label className="exercise-picker__field">
            <span>Nome</span>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Ex.: Amazon press"
              autoFocus
              required
            />
          </label>
        )}

        <div className="app-confirm__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
          <Button type="submit" variant="primary">
            {confirmLabel}
          </Button>
        </div>
      </form>
    </div>
  )
}
