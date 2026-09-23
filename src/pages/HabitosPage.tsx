import { motion } from 'framer-motion'
import {
  Check,
  Flame,
  Minus,
  Pencil,
  Plus,
  Shield,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  formatGoalProgress,
  HABIT_CATEGORY_LABELS,
  HABIT_FREQUENCY_LABELS,
  HABIT_FREEZES_PER_WEEK,
  HABIT_QUICK_IDEAS,
  PERSONAL_GOAL_IDEAS,
  PERSONAL_GOAL_UNITS,
  suggestCategory,
} from '../data/habitosDefaults'
import { DAY_LABELS } from '../data/treinoDefaults'
import {
  PageTransition,
  staggerContainer,
  staggerItem,
} from '../components/ui/PageTransition'
import { Button } from '../components/ui/Button'
import { ActivityHeatmap } from '../components/ui/ActivityHeatmap'
import { useConfirm, useToast } from '../components/ui/Feedback'
import { useBusyAction } from '../hooks/useBusyAction'
import { useFinancas } from '../hooks/useFinancas'
import { useHabitos } from '../hooks/useHabitos'
import { formatBRL, parseBRLInput, sanitizeMoneyTyping } from '../lib/date'
import type {
  Habit,
  HabitCategory,
  HabitFrequency,
  HabitInput,
  PersonalGoal,
} from '../types/habitos'

const CATEGORIES = Object.keys(HABIT_CATEGORY_LABELS) as HabitCategory[]
const FREQUENCIES = Object.keys(HABIT_FREQUENCY_LABELS) as HabitFrequency[]
const CUSTOM_DAYS = [1, 2, 3, 4, 5, 6, 0] // seg → dom

const emptyForm = (): HabitInput & {
  preferredTime: string
  reminderTime: string
  goalBoostAmount: number
  personalBoost: number
} => ({
  name: '',
  detail: '',
  category: 'outro',
  frequency: 'daily',
  customDays: [1, 2, 3, 4, 5],
  goalKind: 'check',
  goalTarget: 1,
  preferredTime: '',
  reminderEnabled: false,
  reminderTime: '09:00',
  linkedPersonalGoalId: null,
  personalBoost: 0,
  linkedGoalId: null,
  goalBoostAmount: 0,
})

function habitMetaLine(
  h: Habit,
  personalGoalName?: string | null,
  financeGoalName?: string | null,
) {
  const bits: string[] = [HABIT_CATEGORY_LABELS[h.category]]
  bits.push(HABIT_FREQUENCY_LABELS[h.frequency])
  if (h.goalKind === 'count') bits.push(`meta ${h.goalTarget}/dia`)
  if (h.preferredTime) bits.push(h.preferredTime)
  if (h.reminderEnabled && h.reminderTime) bits.push(`🔔 ${h.reminderTime}`)
  if (personalGoalName) bits.push(`🎯 ${personalGoalName}`)
  if (financeGoalName) bits.push(`💰 ${financeGoalName}`)
  return bits.join(' · ')
}

export function HabitosPage() {
  const {
    habits,
    personalGoals,
    dueToday,
    doneCount,
    coveredCount,
    total,
    allTotal,
    dayLog,
    toggleHabit,
    bumpHabitProgress,
    skipHabit,
    undoSkipHabit,
    addHabit,
    updateHabit,
    removeHabit,
    addPersonalGoal,
    removePersonalGoal,
    bumpPersonalGoal,
  } = useHabitos()
  const { state: financeState, updateGoalSaved } = useFinancas()
  const savingsGoals = financeState.goals
  const personalGoalNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const g of personalGoals) map.set(g.id, g.name)
    return map
  }, [personalGoals])
  const financeGoalNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const g of savingsGoals) map.set(g.id, g.name)
    return map
  }, [savingsGoals])
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const { busy: saving, run: runSave } = useBusyAction()
  const { busy: savingGoal, run: runSaveGoal } = useBusyAction()
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removingGoalId, setRemovingGoalId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [categoryLocked, setCategoryLocked] = useState(false)
  const [goalForm, setGoalForm] = useState({
    name: '',
    detail: '',
    category: 'saude' as HabitCategory,
    target: '60',
    unit: 'L',
    defaultBoost: '2',
  })

  const freezesLeft = useMemo(() => {
    if (habits.length === 0) return HABIT_FREEZES_PER_WEEK
    return Math.max(...habits.map((h) => h.freezesLeft), 0)
  }, [habits])

  useEffect(() => {
    if (!showForm || !form.name.trim() || categoryLocked || editingId) return
    const suggested = suggestCategory(form.name)
    setForm((f) => (f.category === suggested ? f : { ...f, category: suggested }))
  }, [form.name, showForm, categoryLocked, editingId])

  useEffect(() => {
    const dueReminders = dueToday.filter(
      (h) =>
        h.reminderEnabled &&
        h.reminderTime &&
        !h.doneToday &&
        !h.skippedToday,
    )
    if (dueReminders.length === 0) return
    const now = new Date()
    const mins = now.getHours() * 60 + now.getMinutes()
    for (const h of dueReminders) {
      const [hh, mm] = (h.reminderTime || '09:00').split(':').map(Number)
      const target = hh * 60 + (mm || 0)
      if (Math.abs(mins - target) <= 20) {
        toast(`Lembrete: ${h.name}`, 'info')
        break
      }
    }
  }, [])

  function patchForm(patch: Partial<typeof form>) {
    if (patch.category !== undefined) setCategoryLocked(true)
    setForm((f) => ({ ...f, ...patch }))
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm())
    setCategoryLocked(false)
  }

  function openCreate() {
    if (showForm && !editingId) {
      closeForm()
      return
    }
    setEditingId(null)
    setForm(emptyForm())
    setCategoryLocked(false)
    setShowForm(true)
  }

  function openEdit(h: Habit) {
    setEditingId(h.id)
    setCategoryLocked(true)
    setForm({
      name: h.name,
      detail: h.detail,
      category: h.category,
      frequency: h.frequency,
      customDays: h.customDays?.length ? [...h.customDays] : [1, 2, 3, 4, 5],
      goalKind: h.goalKind,
      goalTarget: h.goalTarget,
      preferredTime: h.preferredTime || '',
      reminderEnabled: h.reminderEnabled,
      reminderTime: h.reminderTime || h.preferredTime || '09:00',
      linkedPersonalGoalId: h.linkedPersonalGoalId,
      personalBoost: h.personalBoost || 0,
      linkedGoalId: h.linkedGoalId,
      goalBoostAmount: h.goalBoostAmount || 0,
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function applyIdea(idea: (typeof HABIT_QUICK_IDEAS)[number]) {
    setEditingId(null)
    setCategoryLocked(true)
    setForm({
      ...emptyForm(),
      name: idea.name,
      detail: idea.detail,
      category: idea.category,
      goalKind: idea.goalKind,
      goalTarget: idea.goalTarget,
      preferredTime: idea.goalKind === 'count' ? '' : '07:30',
    })
    setShowForm(true)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    if (form.frequency === 'custom' && (form.customDays?.length ?? 0) === 0) {
      toast('Escolhe pelo menos um dia', 'warn')
      return
    }
    const payload: HabitInput = {
      name: form.name,
      detail: form.detail,
      category: form.category,
      frequency: form.frequency,
      customDays: form.customDays,
      goalKind: form.goalKind,
      goalTarget: form.goalTarget,
      preferredTime: form.preferredTime || null,
      reminderEnabled: form.reminderEnabled,
      reminderTime: form.reminderEnabled
        ? form.reminderTime || form.preferredTime || '09:00'
        : null,
      linkedPersonalGoalId: form.linkedPersonalGoalId || null,
      personalBoost: form.linkedPersonalGoalId
        ? Math.max(0, Number(form.personalBoost) || 0)
        : 0,
      linkedGoalId: form.linkedGoalId || null,
      goalBoostAmount: form.linkedGoalId
        ? Math.max(0, Number(form.goalBoostAmount) || 0)
        : 0,
    }
    void runSave(() => {
      if (editingId) {
        updateHabit(editingId, payload)
        toast('Hábito atualizado', 'ok')
      } else {
        addHabit(payload)
        toast('Hábito criado', 'ok')
      }
      closeForm()
    })
  }

  async function handleRemove(id: string, label: string) {
    const ok = await confirm({
      title: 'Excluir hábito?',
      message: `“${label}” será removido.`,
      confirmLabel: 'Excluir',
    })
    if (!ok) return
    setRemovingId(id)
    try {
      removeHabit(id)
      toast('Hábito excluído', 'info')
    } finally {
      setRemovingId(null)
    }
  }

  function handleSkip(h: Habit) {
    if (h.skippedToday) {
      undoSkipHabit(h.id)
      toast('Proteção removida — podes concluir hoje', 'info')
      return
    }
    const result = skipHabit(h.id)
    if (result.ok) toast(result.message || 'Sequência protegida', 'ok')
    else toast(result.message || 'Não foi possível proteger', 'warn')
  }

  function boostLinkedGoal(h: Habit) {
    if (h.linkedPersonalGoalId) {
      const pGoal = personalGoals.find((g) => g.id === h.linkedPersonalGoalId)
      if (pGoal) {
        const amount =
          h.personalBoost > 0 ? h.personalBoost : pGoal.defaultBoost
        if (amount > 0) {
          bumpPersonalGoal(pGoal.id, amount)
          toast(
            `+${amount} ${pGoal.unit} em “${pGoal.name}”`,
            'ok',
          )
        }
      }
    }
    if (!h.linkedGoalId || !(h.goalBoostAmount > 0)) return
    const goal = savingsGoals.find((g) => g.id === h.linkedGoalId)
    if (!goal) return
    updateGoalSaved(goal.id, goal.saved + h.goalBoostAmount)
    toast(`+${formatBRL(h.goalBoostAmount)} na meta “${goal.name}”`, 'ok')
  }

  function completeHabitAction(h: Habit) {
    const wasDone = h.doneToday
    if (h.goalKind === 'count' && !wasDone) {
      const next = h.progressToday + 1
      bumpHabitProgress(h.id, 1)
      if (next >= h.goalTarget) {
        boostLinkedGoal(h)
        toast('Meta do dia concluída', 'ok')
      } else {
        toast(`${next}/${h.goalTarget}`, 'ok')
      }
      return
    }
    toggleHabit(h.id)
    if (!wasDone) {
      boostLinkedGoal(h)
      toast('Hábito concluído', 'ok')
    } else {
      toast('Hábito desmarcado', 'ok')
    }
  }

  async function handleRemoveGoal(goal: PersonalGoal) {
    const ok = await confirm({
      title: 'Excluir meta pessoal?',
      message: `“${goal.name}” será removida. Os hábitos deixam de estar ligados a ela.`,
      confirmLabel: 'Excluir',
    })
    if (!ok) return
    setRemovingGoalId(goal.id)
    try {
      removePersonalGoal(goal.id)
      toast('Meta removida', 'info')
    } finally {
      setRemovingGoalId(null)
    }
  }

  function handleAddPersonalGoal(e: FormEvent) {
    e.preventDefault()
    if (!goalForm.name.trim()) return
    const target = Number(String(goalForm.target).replace(',', '.')) || 0
    if (!(target > 0)) {
      toast('Define um alvo válido', 'warn')
      return
    }
    void runSaveGoal(() => {
      addPersonalGoal({
        name: goalForm.name,
        detail: goalForm.detail,
        category: goalForm.category,
        target,
        unit: goalForm.unit,
        defaultBoost: Number(String(goalForm.defaultBoost).replace(',', '.')) || 1,
      })
      setGoalForm({
        name: '',
        detail: '',
        category: 'saude',
        target: '60',
        unit: 'L',
        defaultBoost: '2',
      })
      setShowGoalForm(false)
      toast('Meta pessoal criada', 'ok')
    })
  }

  function applyGoalIdea(idea: (typeof PERSONAL_GOAL_IDEAS)[number]) {
    setGoalForm({
      name: idea.name,
      detail: idea.detail,
      category: idea.category,
      target: String(idea.target),
      unit: idea.unit,
      defaultBoost: String(idea.defaultBoost),
    })
    setShowGoalForm(true)
  }

  const restingToday = habits.filter(
    (h) => !dueToday.some((d) => d.id === h.id),
  )

  return (
    <PageTransition>
      <header className="page-header">
        <div>
          <p className="page-kicker">Consistência</p>
          <h1 className="page-title">Hábitos</h1>
          <p className="page-sub">
            Metas pessoais (água, leitura…), hábitos do dia e, nos dias difíceis,
            proteção de sequência.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={openCreate}
          disabled={saving}
        >
          {showForm && !editingId ? 'Fechar' : 'Novo'}
        </Button>
      </header>

      <div className="surface module-stat">
        <span className="module-stat__icon" style={{ color: 'var(--habitos)' }}>
          <Sparkles size={18} />
        </span>
        <div>
          <strong>
            {doneCount}/{total} hoje
          </strong>
          <span>
            {total === 0
              ? 'Adiciona o primeiro hábito'
              : coveredCount === total
                ? doneCount === total
                  ? 'Dia completo'
                  : `${doneCount} feitos · ${coveredCount - doneCount} protegidos`
                : `${freezesLeft} proteção${freezesLeft === 1 ? '' : 'ões'} esta semana`}
          </span>
        </div>
      </div>

      <ActivityHeatmap log={dayLog} range="month" title="Hábitos no mês" />

      <div className="section-label">
        <h2>Hoje</h2>
        <span>
          {doneCount}/{total}
        </span>
      </div>

      {dueToday.length === 0 ? (
        <div className="surface finance-empty">
          <Sparkles size={24} />
          <p>
            {allTotal === 0
              ? 'Ainda sem hábitos. Cria o primeiro ou usa uma ideia rápida.'
              : 'Nada agendado para hoje — desfruta do descanso.'}
          </p>
        </div>
      ) : (
        <motion.div
          className="surface habit-list"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {dueToday.map((h) => (
            <HabitRow
              key={h.id}
              habit={h}
              linkedGoalName={
                h.linkedPersonalGoalId
                  ? personalGoalNameById.get(h.linkedPersonalGoalId)
                  : null
              }
              financeGoalName={
                h.linkedGoalId ? financeGoalNameById.get(h.linkedGoalId) : null
              }
              removing={removingId === h.id}
              onToggle={() => completeHabitAction(h)}
              onBump={(delta) => {
                const wasDone = h.doneToday
                bumpHabitProgress(h.id, delta)
                if (
                  !wasDone &&
                  delta > 0 &&
                  h.progressToday + delta >= h.goalTarget
                ) {
                  boostLinkedGoal(h)
                }
              }}
              onSkip={() => handleSkip(h)}
              onEdit={() => openEdit(h)}
              onRemove={() => handleRemove(h.id, h.name)}
            />
          ))}
        </motion.div>
      )}

      <div className="section-label">
        <h2>Metas pessoais</h2>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setShowGoalForm((v) => !v)}
        >
          <Plus size={14} />
          {showGoalForm ? 'Fechar' : 'Nova meta'}
        </button>
      </div>

      <div className="habit-ideas" aria-label="Ideias de metas">
        {PERSONAL_GOAL_IDEAS.map((idea) => (
          <button
            key={idea.name}
            type="button"
            className="habit-idea"
            onClick={() => applyGoalIdea(idea)}
          >
            {idea.name}
          </button>
        ))}
      </div>

      {showGoalForm && (
        <form className="surface habit-form" onSubmit={handleAddPersonalGoal}>
          <p className="habit-form__lead">
            Metas como “beber 2 L de água” acumulam progresso quando conclus
            o hábito ligado.
          </p>
          <label className="plan-field">
            <span>Nome da meta</span>
            <input
              type="text"
              value={goalForm.name}
              onChange={(e) =>
                setGoalForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="Ex.: Beber 2 L de água"
              required
              disabled={savingGoal}
            />
          </label>
          <label className="plan-field">
            <span>Nota (opcional)</span>
            <input
              type="text"
              value={goalForm.detail}
              onChange={(e) =>
                setGoalForm((f) => ({ ...f, detail: e.target.value }))
              }
              placeholder="Porquê importa"
              disabled={savingGoal}
            />
          </label>
          <div className="habit-form__row">
            <label className="plan-field">
              <span>Alvo total</span>
              <input
                type="text"
                inputMode="decimal"
                value={goalForm.target}
                onChange={(e) =>
                  setGoalForm((f) => ({ ...f, target: e.target.value }))
                }
                required
                disabled={savingGoal}
              />
            </label>
            <label className="plan-field">
              <span>Unidade</span>
              <select
                value={goalForm.unit}
                onChange={(e) =>
                  setGoalForm((f) => ({ ...f, unit: e.target.value }))
                }
                disabled={savingGoal}
              >
                {PERSONAL_GOAL_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
                {!PERSONAL_GOAL_UNITS.includes(
                  goalForm.unit as (typeof PERSONAL_GOAL_UNITS)[number],
                ) && (
                  <option value={goalForm.unit}>{goalForm.unit}</option>
                )}
              </select>
            </label>
            <label className="plan-field">
              <span>Por cada dia feito</span>
              <input
                type="text"
                inputMode="decimal"
                value={goalForm.defaultBoost}
                onChange={(e) =>
                  setGoalForm((f) => ({ ...f, defaultBoost: e.target.value }))
                }
                placeholder="Ex.: 2"
                disabled={savingGoal}
              />
            </label>
          </div>
          <div className="habit-chips">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={`habit-chip${goalForm.category === c ? ' is-active' : ''}`}
                onClick={() => setGoalForm((f) => ({ ...f, category: c }))}
              >
                {HABIT_CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
          <Button
            type="submit"
            variant="primary"
            icon={<Target size={16} />}
            loading={savingGoal}
            loadingLabel="A guardar…"
          >
            Guardar meta
          </Button>
        </form>
      )}

      {personalGoals.length > 0 && (
        <div className="personal-goals">
          {personalGoals.map((goal) => {
            const { pct, label } = formatGoalProgress(goal)
            const linked = habits.filter(
              (h) => h.linkedPersonalGoalId === goal.id,
            )
            return (
              <article key={goal.id} className="surface personal-goal">
                <div className="personal-goal__head">
                  <span className="personal-goal__icon" aria-hidden>
                    <Target size={16} />
                  </span>
                  <div className="personal-goal__info">
                    <strong>{goal.name}</strong>
                    <span>
                      {HABIT_CATEGORY_LABELS[goal.category]}
                      {goal.detail ? ` · ${goal.detail}` : ''}
                    </span>
                    {linked.length > 0 && (
                      <em>
                        Hábito
                        {linked.length > 1 ? 's' : ''}:{' '}
                        {linked.map((h) => h.name).join(' · ')}
                      </em>
                    )}
                  </div>
                  <span className="personal-goal__pct">{pct}%</span>
                  <Button
                    variant="ghost"
                    className="finance-row__del"
                    icon={<Trash2 size={14} />}
                    loading={removingGoalId === goal.id}
                    onClick={() => handleRemoveGoal(goal)}
                    aria-label={`Excluir ${goal.name}`}
                  />
                </div>
                <div
                  className="finance-meter"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${pct}%` }} />
                </div>
                <div className="personal-goal__foot">
                  <span>{label}</span>
                  {goal.completedAt ? (
                    <em className="is-done">Concluída</em>
                  ) : (
                    <em>
                      +{goal.defaultBoost} {goal.unit}/conclusão
                    </em>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="habit-ideas" aria-label="Ideias rápidas de hábitos">
        {HABIT_QUICK_IDEAS.map((idea) => (
          <button
            key={idea.name}
            type="button"
            className="habit-idea"
            onClick={() => applyIdea(idea)}
          >
            {idea.name}
          </button>
        ))}
      </div>

      {showForm && (
        <form className="surface habit-form" onSubmit={handleSubmit}>
          <p className="habit-form__lead">
            {editingId
              ? 'A editar hábito — a sequência e o histórico mantêm-se.'
              : 'Preenche o essencial. A categoria sugere-se pelo nome; podes ajustar tudo.'}
          </p>

          <label className="plan-field">
            <span>Nome do hábito</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => patchForm({ name: e.target.value })}
              placeholder="Ex.: Beber água"
              required
              disabled={saving}
              autoFocus
            />
          </label>

          <label className="plan-field">
            <span>Nota (opcional)</span>
            <input
              type="text"
              value={form.detail}
              onChange={(e) => patchForm({ detail: e.target.value })}
              placeholder="Porquê isto importa para ti"
              disabled={saving}
            />
          </label>

          <fieldset className="habit-form__group">
            <legend>Categoria</legend>
            <p className="habit-form__hint">
              Organiza a lista e ajuda a Home a fazer sentido.
            </p>
            <div className="habit-chips">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`habit-chip${form.category === c ? ' is-active' : ''}`}
                  onClick={() => patchForm({ category: c })}
                >
                  {HABIT_CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="habit-form__group">
            <legend>Frequência</legend>
            <p className="habit-form__hint">
              Só nos dias escolhidos é que a sequência pode subir ou cair.
            </p>
            <div className="habit-chips">
              {FREQUENCIES.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`habit-chip${form.frequency === f ? ' is-active' : ''}`}
                  onClick={() => patchForm({ frequency: f })}
                >
                  {HABIT_FREQUENCY_LABELS[f]}
                </button>
              ))}
            </div>
            {form.frequency === 'custom' && (
              <div className="habit-chips habit-chips--days">
                {CUSTOM_DAYS.map((d) => {
                  const on = form.customDays?.includes(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      className={`habit-chip${on ? ' is-active' : ''}`}
                      onClick={() => {
                        const cur = form.customDays ?? []
                        patchForm({
                          customDays: on
                            ? cur.filter((x) => x !== d)
                            : [...cur, d],
                        })
                      }}
                    >
                      {DAY_LABELS[d]}
                    </button>
                  )
                })}
              </div>
            )}
          </fieldset>

          <fieldset className="habit-form__group">
            <legend>Meta do dia</legend>
            <p className="habit-form__hint">
              <strong>Feito</strong> = um toque. <strong>Contagem</strong> =
              progresso (ex.: 8 copos de água).
            </p>
            <div className="habit-chips">
              <button
                type="button"
                className={`habit-chip${form.goalKind === 'check' ? ' is-active' : ''}`}
                onClick={() => patchForm({ goalKind: 'check', goalTarget: 1 })}
              >
                Feito / não feito
              </button>
              <button
                type="button"
                className={`habit-chip${form.goalKind === 'count' ? ' is-active' : ''}`}
                onClick={() =>
                  patchForm({
                    goalKind: 'count',
                    goalTarget: Math.max(2, form.goalTarget || 8),
                  })
                }
              >
                Contagem
              </button>
            </div>
            {form.goalKind === 'count' && (
              <label className="plan-field plan-field--short">
                <span>Quantas vezes por dia?</span>
                <input
                  type="number"
                  min={2}
                  max={99}
                  value={form.goalTarget}
                  onChange={(e) =>
                    patchForm({
                      goalTarget: Math.max(2, Number(e.target.value) || 2),
                    })
                  }
                />
              </label>
            )}
          </fieldset>

          <div className="habit-form__row">
            <label className="plan-field">
              <span>Horário preferido</span>
              <input
                type="time"
                value={form.preferredTime}
                onChange={(e) => patchForm({ preferredTime: e.target.value })}
                disabled={saving}
              />
            </label>
            <label className="plan-field">
              <span>Lembrete</span>
              <div className="habit-reminder">
                <button
                  type="button"
                  className={`config-switch${form.reminderEnabled ? ' is-on' : ''}`}
                  role="switch"
                  aria-checked={form.reminderEnabled}
                  onClick={() =>
                    patchForm({
                      reminderEnabled: !form.reminderEnabled,
                      reminderTime:
                        form.reminderTime || form.preferredTime || '09:00',
                    })
                  }
                >
                  <span className="config-switch__knob" />
                </button>
                <input
                  type="time"
                  value={form.reminderTime}
                  disabled={!form.reminderEnabled || saving}
                  onChange={(e) => patchForm({ reminderTime: e.target.value })}
                />
              </div>
            </label>
          </div>

          <fieldset className="habit-form__group">
            <legend>Meta pessoal</legend>
            <p className="habit-form__hint">
              Liga a uma meta como “beber 2 L”. Ao concluir o dia, o progresso
              sobe automaticamente.
            </p>
            <label className="plan-field">
              <span>Associar a</span>
              <select
                value={form.linkedPersonalGoalId || ''}
                onChange={(e) => {
                  const id = e.target.value || null
                  const g = personalGoals.find((x) => x.id === id)
                  patchForm({
                    linkedPersonalGoalId: id,
                    personalBoost: id ? form.personalBoost || g?.defaultBoost || 0 : 0,
                  })
                }}
                disabled={saving}
              >
                <option value="">Nenhuma</option>
                {personalGoals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.current}/{g.target} {g.unit})
                  </option>
                ))}
              </select>
            </label>
            {personalGoals.length === 0 && (
              <p className="habit-form__hint">
                Cria primeiro uma meta pessoal acima.
              </p>
            )}
            {form.linkedPersonalGoalId && (
              <label className="plan-field">
                <span>Quanto somar por conclusão (0 = usa o padrão da meta)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={
                    form.personalBoost
                      ? String(form.personalBoost).replace('.', ',')
                      : ''
                  }
                  onChange={(e) => {
                    const n = Number(
                      e.target.value.replace(',', '.').replace(/[^\d.]/g, ''),
                    )
                    patchForm({
                      personalBoost: Number.isFinite(n) ? n : 0,
                    })
                  }}
                  disabled={saving}
                />
              </label>
            )}
          </fieldset>

          <fieldset className="habit-form__group">
            <legend>Meta de poupança (Finanças)</legend>
            <p className="habit-form__hint">
              Opcional — se quiseres ligar também a dinheiro.
            </p>
            <label className="plan-field">
              <span>Associar a</span>
              <select
                value={form.linkedGoalId || ''}
                onChange={(e) =>
                  patchForm({
                    linkedGoalId: e.target.value || null,
                    goalBoostAmount: e.target.value
                      ? form.goalBoostAmount
                      : 0,
                  })
                }
                disabled={saving}
              >
                <option value="">Nenhuma meta</option>
                {savingsGoals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({formatBRL(g.saved)} / {formatBRL(g.target)})
                  </option>
                ))}
              </select>
            </label>
            {form.linkedGoalId && (
              <label className="plan-field">
                <span>Ao concluir, somar à meta (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex.: 5,00"
                  value={
                    form.goalBoostAmount
                      ? String(form.goalBoostAmount).replace('.', ',')
                      : ''
                  }
                  onChange={(e) => {
                    const typed = sanitizeMoneyTyping(e.target.value)
                    const n = parseBRLInput(typed)
                    patchForm({
                      goalBoostAmount: n ?? 0,
                    })
                  }}
                  disabled={saving}
                />
              </label>
            )}
          </fieldset>

          <p className="habit-form__hint">
            O lembrete aparece na app perto da hora (com a app aberta). A
            sequência usa até {HABIT_FREEZES_PER_WEEK} proteções por semana nos
            dias difíceis.
          </p>

          <div className="habit-form__actions">
            {editingId && (
              <button
                type="button"
                className="btn btn--cancel"
                onClick={closeForm}
                disabled={saving}
              >
                Cancelar
              </button>
            )}
            <Button
              type="submit"
              variant="primary"
              icon={editingId ? <Pencil size={16} /> : <Plus size={16} />}
              loading={saving}
              loadingLabel="A guardar…"
            >
              {editingId ? 'Guardar alterações' : 'Guardar hábito'}
            </Button>
          </div>
        </form>
      )}

      {restingToday.length > 0 && (
        <>
          <div className="section-label">
            <h2>Fora de hoje</h2>
            <span>{restingToday.length}</span>
          </div>
          <div className="surface habit-list habit-list--rest">
            {restingToday.map((h) => (
              <div key={h.id} className="habit-row is-rest">
                <span className="habit-info">
                  <strong>{h.name}</strong>
                  <span>
                    {habitMetaLine(
                      h,
                      h.linkedPersonalGoalId
                        ? personalGoalNameById.get(h.linkedPersonalGoalId)
                        : null,
                      h.linkedGoalId
                        ? financeGoalNameById.get(h.linkedGoalId)
                        : null,
                    )}
                  </span>
                </span>
                <span className="streak">
                  <Flame size={12} /> {h.streak}d
                </span>
                <div className="habit-row__tools">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => openEdit(h)}
                    aria-label={`Editar ${h.name}`}
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <Button
                    variant="ghost"
                    className="finance-row__del"
                    icon={<Trash2 size={14} />}
                    loading={removingId === h.id}
                    onClick={() => handleRemove(h.id, h.name)}
                    title="Excluir"
                    aria-label={`Excluir ${h.name}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </PageTransition>
  )
}

function HabitRow({
  habit: h,
  linkedGoalName,
  financeGoalName,
  removing,
  onToggle,
  onBump,
  onSkip,
  onEdit,
  onRemove,
}: {
  habit: Habit
  linkedGoalName?: string | null
  financeGoalName?: string | null
  removing: boolean
  onToggle: () => void
  onBump: (delta: number) => void
  onSkip: () => void
  onEdit: () => void
  onRemove: () => void
}) {
  const status = h.doneToday
    ? 'Feito'
    : h.skippedToday
      ? 'Protegido'
      : h.goalKind === 'count'
        ? `${h.progressToday}/${h.goalTarget}`
        : 'Pendente'

  return (
    <motion.div
      className={`habit-row${h.skippedToday ? ' is-skipped' : ''}${h.doneToday ? ' is-done-row' : ''}`}
      variants={staggerItem}
    >
      <button
        type="button"
        className={`habit-check${h.doneToday ? ' is-done' : ''}${h.skippedToday ? ' is-skipped' : ''}`}
        onClick={onToggle}
        aria-label={
          h.doneToday ? `Desmarcar ${h.name}` : `Concluir ${h.name}`
        }
      >
        {h.doneToday ? (
          <Check size={16} strokeWidth={3} />
        ) : h.skippedToday ? (
          <Shield size={14} />
        ) : null}
      </button>

      <span className="habit-info">
        <strong>{h.name}</strong>
        <span>
          {habitMetaLine(h, linkedGoalName, financeGoalName)}
          {h.goalKind !== 'count' || h.doneToday || h.skippedToday
            ? ` · ${status}`
            : ''}
        </span>
      </span>

      <span className="streak" title="Sequência atual">
        <Flame size={12} /> {h.streak}d
      </span>

      <div className="habit-row__tools">
        {h.goalKind === 'count' && !h.doneToday && !h.skippedToday && (
          <div className="habit-count">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => onBump(-1)}
              disabled={h.progressToday <= 0}
              aria-label="Menos"
            >
              <Minus size={14} />
            </button>
            <span>
              {h.progressToday}/{h.goalTarget}
            </span>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => onBump(1)}
              aria-label="Mais"
            >
              <Plus size={14} />
            </button>
          </div>
        )}

        <button
          type="button"
          className={`btn btn--ghost habit-skip${h.skippedToday ? ' is-on' : ''}`}
          onClick={onSkip}
          title="Dia difícil — protege a sequência"
          aria-label="Dia difícil"
          disabled={h.doneToday && !h.skippedToday}
        >
          <Shield size={14} />
        </button>

        <button
          type="button"
          className="btn btn--ghost"
          onClick={onEdit}
          title="Editar"
          aria-label={`Editar ${h.name}`}
        >
          <Pencil size={14} />
        </button>

        <Button
          variant="ghost"
          className="finance-row__del"
          icon={<Trash2 size={14} />}
          loading={removing}
          onClick={onRemove}
          title="Excluir"
          aria-label={`Excluir ${h.name}`}
        />
      </div>
    </motion.div>
  )
}
