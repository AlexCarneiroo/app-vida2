import { AnimatePresence, motion } from 'framer-motion'
import {
  Bookmark,
  Check,
  ChevronDown,
  LayoutTemplate,
  Plus,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  PLAN_GOAL_LABELS,
  PLAN_PRESETS,
  type PlanGoal,
  type WeeklyPlanPreset,
} from '../../data/planPresets'
import { DAY_LABELS } from '../../data/treinoDefaults'
import type { SavedCustomPlan } from '../../types/treino'
import { Button } from '../ui/Button'
import { useConfirm, useToast } from '../ui/Feedback'

const GOAL_FILTERS: Array<PlanGoal | 'all'> = [
  'all',
  'hipertrofia',
  'força',
  'emagrecer',
  'iniciante',
  'definição',
]

type PlanPresetsProps = {
  activePresetId: string | null
  activeSavedPlanId: string | null
  savedPlans: SavedCustomPlan[]
  onApply: (presetId: string) => void
  onApplySaved: (planId: string) => void
  onRemoveSaved: (planId: string) => void
  onCreateCustom: () => void
  onDone: () => void
}

export function PlanPresets({
  activePresetId,
  activeSavedPlanId,
  savedPlans,
  onApply,
  onApplySaved,
  onRemoveSaved,
  onCreateCustom,
  onDone,
}: PlanPresetsProps) {
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const [goal, setGoal] = useState<PlanGoal | 'all'>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const list = useMemo(() => {
    if (goal === 'all') return PLAN_PRESETS
    return PLAN_PRESETS.filter((p) => p.goal === goal)
  }, [goal])

  function handleApply(preset: WeeklyPlanPreset) {
    if (confirmId !== preset.id) {
      setConfirmId(preset.id)
      setOpenId(preset.id)
      return
    }
    onApply(preset.id)
    setConfirmId(null)
    onDone()
  }

  function handleApplySaved(plan: SavedCustomPlan) {
    if (confirmId !== plan.id) {
      setConfirmId(plan.id)
      setOpenId(plan.id)
      return
    }
    onApplySaved(plan.id)
    setConfirmId(null)
    toast('Plano personalizado aplicado', 'ok')
    onDone()
  }

  async function handleRemoveSaved(plan: SavedCustomPlan) {
    const ok = await confirm({
      title: 'Apagar plano guardado?',
      message: `“${plan.name}” será removido da tua lista.`,
      confirmLabel: 'Apagar',
    })
    if (!ok) return
    setRemovingId(plan.id)
    onRemoveSaved(plan.id)
    setRemovingId(null)
    toast('Plano removido', 'info')
  }

  return (
    <div className="plan-presets">
      <p className="plan-presets__intro">
        Os teus planos guardados aparecem primeiro. Também podes criar um plano
        do zero ou escolher um pronto e depois editar.
      </p>

      <button
        type="button"
        className="surface surface--interactive plan-create-card"
        onClick={onCreateCustom}
      >
        <span className="plan-create-card__icon" aria-hidden>
          <Plus size={20} />
        </span>
        <span className="plan-create-card__copy">
          <strong>Criar o meu plano</strong>
          <span>Monta treinos à tua preferência, dia a dia</span>
        </span>
      </button>

      {savedPlans.length > 0 && (
        <>
          <div className="section-label">
            <h2>Os meus planos</h2>
            <span>{savedPlans.length}</span>
          </div>
          <div className="plan-presets__list">
            {savedPlans.map((plan) => {
              const isOpen = openId === plan.id
              const isActive = activeSavedPlanId === plan.id
              const confirming = confirmId === plan.id
              return (
                <article
                  key={plan.id}
                  className={`surface plan-preset-card plan-preset-card--saved${isActive ? ' is-current' : ''}`}
                >
                  <button
                    type="button"
                    className="plan-preset-card__head"
                    onClick={() => setOpenId(isOpen ? null : plan.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="plan-preset-card__icon is-saved">
                      <Bookmark size={18} />
                    </span>
                    <span className="plan-preset-card__info">
                      <strong>{plan.name}</strong>
                      <span>
                        {plan.tagline ||
                          `${plan.templates.length} dias · personalizado`}
                      </span>
                    </span>
                    <ChevronDown
                      size={16}
                      className={`treino-ex__chevron${isOpen ? ' is-open' : ''}`}
                    />
                  </button>

                  <div className="plan-preset-card__meta">
                    <em>Personalizado</em>
                    <em>{plan.templates.length} dias</em>
                    {isActive && (
                      <em className="is-current-tag">
                        <Check size={12} /> Atual
                      </em>
                    )}
                  </div>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        className="plan-preset-card__body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <ul className="plan-preset-card__days">
                          {plan.templates
                            .slice()
                            .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                            .map((t) => (
                              <li key={t.id}>
                                <strong>{DAY_LABELS[t.dayOfWeek]}</strong>
                                <span>
                                  {t.name} · {t.exercises.length} ex. · ~
                                  {t.estimatedMin} min
                                </span>
                              </li>
                            ))}
                        </ul>

                        <div className="plan-preset-card__row-actions">
                          <button
                            type="button"
                            className={`btn ${confirming ? 'btn--primary' : 'btn--ghost'}`}
                            onClick={() => handleApplySaved(plan)}
                            disabled={isActive}
                          >
                            {isActive
                              ? 'Já estás neste plano'
                              : confirming
                                ? 'Confirmar — aplicar'
                                : 'Usar este plano'}
                          </button>
                          <Button
                            variant="ghost"
                            className="finance-row__del"
                            icon={<Trash2 size={14} />}
                            loading={removingId === plan.id}
                            onClick={() => handleRemoveSaved(plan)}
                            aria-label={`Apagar ${plan.name}`}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </article>
              )
            })}
          </div>
        </>
      )}

      <div className="section-label">
        <h2>Planos prontos</h2>
        <span>{list.length}</span>
      </div>

      <div className="plan-presets__filters" role="tablist">
        {GOAL_FILTERS.map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={goal === g}
            className={`plan-presets__chip${goal === g ? ' is-active' : ''}`}
            onClick={() => setGoal(g)}
          >
            {g === 'all' ? 'Todos' : PLAN_GOAL_LABELS[g]}
          </button>
        ))}
      </div>

      <div className="plan-presets__list">
        {list.map((preset) => {
          const isOpen = openId === preset.id
          const isActive = activePresetId === preset.id
          const confirming = confirmId === preset.id
          return (
            <article
              key={preset.id}
              className={`surface plan-preset-card${isActive ? ' is-current' : ''}`}
            >
              <button
                type="button"
                className="plan-preset-card__head"
                onClick={() => setOpenId(isOpen ? null : preset.id)}
                aria-expanded={isOpen}
              >
                <span className="plan-preset-card__icon">
                  <LayoutTemplate size={18} />
                </span>
                <span className="plan-preset-card__info">
                  <strong>{preset.name}</strong>
                  <span>{preset.tagline}</span>
                </span>
                <ChevronDown
                  size={16}
                  className={`treino-ex__chevron${isOpen ? ' is-open' : ''}`}
                />
              </button>

              <div className="plan-preset-card__meta">
                <em>{PLAN_GOAL_LABELS[preset.goal]}</em>
                <em>{preset.daysPerWeek} dias/sem</em>
                <em>{preset.level}</em>
                {isActive && (
                  <em className="is-current-tag">
                    <Check size={12} /> Atual
                  </em>
                )}
              </div>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    className="plan-preset-card__body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <ul className="plan-preset-card__days">
                      {preset.templates
                        .slice()
                        .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                        .map((t) => (
                          <li key={t.id}>
                            <strong>{DAY_LABELS[t.dayOfWeek]}</strong>
                            <span>
                              {t.name} · {t.exercises.length} ex. · ~
                              {t.estimatedMin} min
                            </span>
                          </li>
                        ))}
                    </ul>

                    <button
                      type="button"
                      className={`btn ${confirming ? 'btn--primary' : 'btn--ghost'}`}
                      onClick={() => handleApply(preset)}
                      disabled={isActive}
                    >
                      {isActive
                        ? 'Já estás neste plano'
                        : confirming
                          ? 'Confirmar — substituir semana'
                          : 'Usar este plano'}
                    </button>
                    {confirming && (
                      <p className="plan-preset-card__warn">
                        Substitui o plano atual. O histórico de treinos
                        mantém-se.
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </article>
          )
        })}
      </div>

      <button type="button" className="btn btn--ghost" onClick={onDone}>
        Voltar ao plano
      </button>
    </div>
  )
}
