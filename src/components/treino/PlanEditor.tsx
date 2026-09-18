import { ChevronLeft, ChevronRight, Moon, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  defaultExerciseName,
  exercisesForMuscle,
  MUSCLE_LABELS,
} from '../../data/exerciseLibrary'
import {
  DAY_LABELS,
  DAY_NAMES,
  MUSCLE_GROUPS,
  PLAN_DAY_ORDER,
} from '../../data/treinoDefaults'
import type { MuscleGroup, WorkoutTemplate } from '../../types/treino'
import { useConfirm, useToast } from '../ui/Feedback'

type PlanEditorProps = {
  plan: WorkoutTemplate[]
  onUpdateTemplate: (
    templateId: string,
    patch: Partial<Omit<WorkoutTemplate, 'id' | 'exercises'>>,
  ) => void
  onAddTemplate: (dayOfWeek?: number) => void
  onRemoveTemplate: (templateId: string) => void
  onAddExercise: (templateId: string) => void
  onUpdateExercise: (
    templateId: string,
    exerciseId: string,
    patch: Partial<{
      name: string
      muscle: MuscleGroup
      notes: string
    }>,
  ) => void
  onRemoveExercise: (templateId: string, exerciseId: string) => void
  onAddSet: (templateId: string, exerciseId: string) => void
  onRemoveSet: (templateId: string, exerciseId: string, setIndex: number) => void
  onUpdateSet: (
    templateId: string,
    exerciseId: string,
    setIndex: number,
    patch: Partial<{ reps: number; weight: number }>,
  ) => void
  onReset: () => void
  onDone: () => void
}

export function PlanEditor({
  plan,
  onUpdateTemplate,
  onAddTemplate,
  onRemoveTemplate,
  onAddExercise,
  onUpdateExercise,
  onRemoveExercise,
  onAddSet,
  onRemoveSet,
  onUpdateSet,
  onReset,
  onDone,
}: PlanEditorProps) {
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const [dayIndex, setDayIndex] = useState(0) // índice em PLAN_DAY_ORDER
  const [customExId, setCustomExId] = useState<string | null>(null)

  const dayOfWeek = PLAN_DAY_ORDER[dayIndex]
  const template = useMemo(
    () => plan.find((t) => t.dayOfWeek === dayOfWeek) ?? null,
    [plan, dayOfWeek],
  )
  const isRest = !template
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  const stepLabel = `${dayIndex + 1} / ${PLAN_DAY_ORDER.length}`

  function goPrev() {
    setCustomExId(null)
    setDayIndex((i) => Math.max(0, i - 1))
  }

  function goNext() {
    setCustomExId(null)
    if (dayIndex >= PLAN_DAY_ORDER.length - 1) {
      onDone()
      return
    }
    setDayIndex((i) => i + 1)
  }

  function enableWorkout() {
    onAddTemplate(dayOfWeek)
    toast('Dia marcado para treinar', 'ok')
  }

  async function setAsRest() {
    if (!template) return
    const ok = await confirm({
      title: 'Marcar como folga?',
      message: `O treino de ${DAY_NAMES[dayOfWeek]} será removido.`,
      confirmLabel: 'Marcar folga',
    })
    if (!ok) return
    onRemoveTemplate(template.id)
    toast('Dia marcado como folga', 'info')
  }

  async function handleRemoveExercise(exerciseId: string, name: string) {
    if (!template) return
    const ok = await confirm({
      title: 'Excluir exercício?',
      message: name ? `“${name}” sai deste dia.` : 'Este exercício será removido.',
      confirmLabel: 'Excluir',
    })
    if (!ok) return
    onRemoveExercise(template.id, exerciseId)
    toast('Exercício excluído', 'info')
  }

  async function handleRemoveSet(exerciseId: string, setIndex: number) {
    if (!template) return
    const ok = await confirm({
      title: 'Excluir série?',
      message: 'Esta série será removida do exercício.',
      confirmLabel: 'Excluir',
    })
    if (!ok) return
    onRemoveSet(template.id, exerciseId, setIndex)
    toast('Série excluída', 'info')
  }

  async function handleReset() {
    const ok = await confirm({
      title: 'Restaurar plano padrão?',
      message: 'As alterações do plano semanal serão perdidas.',
      confirmLabel: 'Restaurar',
    })
    if (!ok) return
    onReset()
    toast('Plano restaurado', 'ok')
  }

  function changeMuscle(exerciseId: string, muscle: MuscleGroup) {
    if (!template) return
    onUpdateExercise(template.id, exerciseId, {
      muscle,
      name: defaultExerciseName(muscle),
    })
    setCustomExId(null)
  }

  function changeExerciseName(exerciseId: string, value: string) {
    if (!template) return
    if (value === '__other__') {
      setCustomExId(exerciseId)
      onUpdateExercise(template.id, exerciseId, { name: '' })
      return
    }
    setCustomExId(null)
    onUpdateExercise(template.id, exerciseId, { name: value })
  }

  return (
    <div className="plan-editor">
      <div className="plan-editor__toolbar">
        <p className="plan-editor__hint">
          Monta <strong>um dia de cada vez</strong>. Sábado e domingo (e
          qualquer outro) podes deixar como descanso.
        </p>
        <div className="plan-editor__actions">
          <button type="button" className="btn btn--ghost" onClick={handleReset}>
            Padrão
          </button>
          <button type="button" className="btn btn--primary" onClick={onDone}>
            Pronto
          </button>
        </div>
      </div>

      <div className="plan-day-tabs" role="tablist" aria-label="Dias da semana">
        {PLAN_DAY_ORDER.map((dow, i) => {
          const has = plan.some((t) => t.dayOfWeek === dow)
          const weekend = dow === 0 || dow === 6
          return (
            <button
              key={dow}
              type="button"
              role="tab"
              aria-selected={i === dayIndex}
              className={`plan-day-tab${i === dayIndex ? ' is-active' : ''}${has ? ' has-workout' : ''}${weekend ? ' is-weekend' : ''}`}
              onClick={() => {
                setCustomExId(null)
                setDayIndex(i)
              }}
            >
              <span>{DAY_LABELS[dow]}</span>
              <em>{has ? 'treino' : 'folga'}</em>
            </button>
          )
        })}
      </div>

      <article className="surface plan-day-panel">
        <div className="plan-day-panel__head">
          <div>
            <p className="page-kicker">
              Passo {stepLabel}
              {isWeekend ? ' · opcional' : ''}
            </p>
            <h2>{DAY_NAMES[dayOfWeek]}</h2>
          </div>
          <div className="plan-day-toggle">
            <button
              type="button"
              className={`plan-day-toggle__btn${!isRest ? ' is-active' : ''}`}
              onClick={enableWorkout}
              disabled={!isRest}
            >
              Treinar
            </button>
            <button
              type="button"
              className={`plan-day-toggle__btn${isRest ? ' is-active is-rest' : ''}`}
              onClick={setAsRest}
              disabled={isRest}
            >
              <Moon size={14} />
              Descanso
            </button>
          </div>
        </div>

        {isRest ? (
          <div className="plan-rest">
            <Moon size={28} />
            <p>
              {isWeekend
                ? 'Fim de semana em descanso. Se quiseres treinar, toca em Treinar.'
                : 'Dia sem treino. Podes voltar a ativar quando quiseres.'}
            </p>
          </div>
        ) : (
          template && (
            <>
              <div className="plan-day-meta">
                <label className="plan-field plan-field--grow">
                  <span>Nome do treino</span>
                  <input
                    type="text"
                    value={template.name}
                    onChange={(e) =>
                      onUpdateTemplate(template.id, { name: e.target.value })
                    }
                    placeholder="Ex.: Pernas"
                  />
                </label>
                <label className="plan-field plan-field--short">
                  <span>Min</span>
                  <input
                    type="number"
                    min={5}
                    value={template.estimatedMin}
                    onChange={(e) =>
                      onUpdateTemplate(template.id, {
                        estimatedMin: Number(e.target.value) || 0,
                      })
                    }
                  />
                </label>
              </div>

              <label className="plan-field">
                <span>Foco (opcional)</span>
                <input
                  type="text"
                  value={template.focus}
                  onChange={(e) =>
                    onUpdateTemplate(template.id, { focus: e.target.value })
                  }
                  placeholder="Ex.: Quadríceps e glúteo"
                />
              </label>

              <div className="plan-block__exercises">
                {template.exercises.map((ex, exIndex) => {
                  const library = exercisesForMuscle(ex.muscle)
                  const inLibrary = library.includes(ex.name)
                  const showCustom =
                    customExId === ex.id || (!inLibrary && ex.name.length > 0)
                  const selectValue = showCustom
                    ? '__other__'
                    : inLibrary
                      ? ex.name
                      : library[0]

                  return (
                    <div key={ex.id} className="plan-ex">
                      <div className="plan-ex__top">
                        <span className="plan-ex__index">{exIndex + 1}</span>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() =>
                            handleRemoveExercise(ex.id, ex.name)
                          }
                          disabled={template.exercises.length <= 1}
                          title="Remover"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <label className="plan-field">
                        <span>Grupo muscular</span>
                        <select
                          value={ex.muscle}
                          onChange={(e) =>
                            changeMuscle(
                              ex.id,
                              e.target.value as MuscleGroup,
                            )
                          }
                        >
                          {MUSCLE_GROUPS.map((m) => (
                            <option key={m} value={m}>
                              {MUSCLE_LABELS[m]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="plan-field">
                        <span>Exercício</span>
                        <select
                          value={selectValue}
                          onChange={(e) =>
                            changeExerciseName(ex.id, e.target.value)
                          }
                        >
                          {library.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                          <option value="__other__">Outro (escrever)…</option>
                        </select>
                      </label>

                      {showCustom && (
                        <label className="plan-field">
                          <span>Nome personalizado</span>
                          <input
                            type="text"
                            value={ex.name}
                            placeholder="Escreve o exercício"
                            autoFocus={customExId === ex.id}
                            onChange={(e) =>
                              onUpdateExercise(template.id, ex.id, {
                                name: e.target.value,
                              })
                            }
                          />
                        </label>
                      )}

                      <div className="plan-ex__sets">
                        {ex.sets.map((set, setIndex) => (
                          <div key={setIndex} className="plan-ex__set">
                            <span className="plan-ex__set-n">{setIndex + 1}</span>
                            <label className="plan-field">
                              <span>Reps</span>
                              <input
                                type="number"
                                min={0}
                                value={set.reps}
                                onChange={(e) =>
                                  onUpdateSet(template.id, ex.id, setIndex, {
                                    reps: Number(e.target.value) || 0,
                                  })
                                }
                              />
                            </label>
                            <label className="plan-field">
                              <span>Carga</span>
                              <input
                                type="number"
                                min={0}
                                step={0.5}
                                value={set.weight}
                                onChange={(e) =>
                                  onUpdateSet(template.id, ex.id, setIndex, {
                                    weight: Number(e.target.value) || 0,
                                  })
                                }
                              />
                            </label>
                            <button
                              type="button"
                              className="btn btn--ghost"
                              onClick={() => handleRemoveSet(ex.id, setIndex)}
                              disabled={ex.sets.length <= 1}
                              title="Remover série"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn btn--ghost plan-ex__add-set"
                          onClick={() => onAddSet(template.id, ex.id)}
                        >
                          <Plus size={14} />
                          Série
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => onAddExercise(template.id)}
              >
                <Plus size={16} />
                Exercício
              </button>
            </>
          )
        )}

        <div className="plan-day-nav">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={goPrev}
            disabled={dayIndex === 0}
          >
            <ChevronLeft size={16} />
            Anterior
          </button>
          <button type="button" className="btn btn--primary" onClick={goNext}>
            {dayIndex >= PLAN_DAY_ORDER.length - 1 ? 'Concluir' : 'Próximo dia'}
            {dayIndex < PLAN_DAY_ORDER.length - 1 && (
              <ChevronRight size={16} />
            )}
          </button>
        </div>
      </article>
    </div>
  )
}
