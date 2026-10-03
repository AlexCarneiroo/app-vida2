import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock,
  Dumbbell,
  Flame,
  LayoutTemplate,
  LineChart,
  Minus,
  Moon,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ExercisePickerSheet } from '../components/treino/ExercisePickerSheet'
import { HistoryList } from '../components/treino/HistoryList'
import { InstructorEffortSheet } from '../components/treino/InstructorEffortSheet'
import { PlanEditor } from '../components/treino/PlanEditor'
import { PlanPresets } from '../components/treino/PlanPresets'
import { ProgressionPanel } from '../components/treino/ProgressionPanel'
import { RestTimer } from '../components/treino/RestTimer'
import { WorkoutSummaryCard } from '../components/treino/WorkoutSummaryCard'
import { ActivityHeatmap } from '../components/ui/ActivityHeatmap'
import { Button } from '../components/ui/Button'
import {
  PageTransition,
  staggerContainer,
  staggerItem,
} from '../components/ui/PageTransition'
import { ProgressRing } from '../components/ui/ProgressRing'
import { useConfirm, useToast } from '../components/ui/Feedback'
import { useBusyAction } from '../hooks/useBusyAction'
import { getPresetById } from '../data/planPresets'
import { DAY_LABELS, DAY_NAMES, clonePlan } from '../data/treinoDefaults'
import { treinoDayLog } from '../lib/activityHeatmap'
import { useSaude } from '../hooks/useSaude'
import { useTreino } from '../hooks/useTreino'
import { dateKey, weekDates } from '../lib/date'
import {
  instructorTip,
  lastSessionMaxWeight,
  shouldAskInstructor,
  workoutSetsDone,
  workoutVolume,
} from '../lib/treinoStats'
import type {
  ActiveWorkout,
  EffortLevel,
  Exercise,
  TreinoSettings,
  WorkoutTemplate,
} from '../types/treino'

type IdleView = 'plan' | 'edit' | 'progress' | 'presets' | 'history'

const REST_PRESETS: TreinoSettings['restSeconds'][] = [60, 90, 120]

export function TreinoPage() {
  const {
    state,
    todayKey,
    todayTemplate,
    isTodayDone,
    plan,
    progression,
    lastSummary,
    clearSummary,
    startWorkout,
    discardWorkout,
    toggleSet,
    updateSet,
    addActiveSet,
    removeActiveSet,
    addActiveExercise,
    replaceActiveExercise,
    removeActiveExercise,
    applySuggestedWeight,
    suggestionFor,
    completeWorkout,
    setRestSeconds,
    setRestTimerEnabled,
    applyInstructorEffort,
    updateTemplate,
    addTemplate,
    removeTemplate,
    addExercise,
    updateExercise,
    removeExercise,
    addTemplateSet,
    removeTemplateSet,
    updateTemplateSet,
    resetPlan,
    restorePlanEdit,
    startBlankCustomPlan,
    applyPreset,
    saveCurrentPlan,
    applySavedPlan,
    removeSavedPlan,
    updateSavedPlanFromCurrent,
    stats,
  } = useTreino()
  const { poorSleepForTraining, lastNightSleep } = useSaude()

  const { toast } = useToast()
  const { confirm } = useConfirm()
  const { busy: completing, run: runComplete } = useBusyAction()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [rest, setRest] = useState<{ key: number; seconds: number } | null>(
    null,
  )
  const [idleView, setIdleView] = useState<IdleView>('plan')
  const [inSession, setInSession] = useState(false)
  const [editSnapshot, setEditSnapshot] = useState<{
    plan: WorkoutTemplate[]
    activePresetId: string | null
    activeSavedPlanId: string | null
  } | null>(null)
  const [selectedDayKey, setSelectedDayKey] = useState<string>(() => dateKey())
  const [picker, setPicker] = useState<
    null | { mode: 'add' } | { mode: 'swap'; exerciseId: string }
  >(null)
  const [effortPrompt, setEffortPrompt] = useState<{
    exerciseId: string
    exerciseName: string
    lastWeight: number | null
  } | null>(null)
  const days = useMemo(() => weekDates(), [])

  const active = state.active
  const showSession = Boolean(active && inSession)
  const showSummary = Boolean(lastSummary) && !showSession
  const showHome = !showSession && !showSummary && idleView === 'plan'
  const showPanel = !showSession && !showSummary && idleView !== 'plan'
  const panelMeta = showSummary
    ? {
        kicker: 'Sessão',
        title: 'Sessão concluída',
        sub: lastSummary
          ? `${lastSummary.name} · resumo desta sessão.`
          : 'Resumo desta sessão.',
      }
    : idleView === 'edit'
      ? {
          kicker: 'Plano',
          title: 'Editar plano',
          sub: 'Monta um dia de cada vez e guarda quando estiver pronto.',
        }
      : idleView === 'presets'
        ? {
            kicker: 'Plano',
            title: 'Planos',
            sub: 'Escolhe um plano pronto ou um que tenhas guardado.',
          }
        : idleView === 'progress'
          ? {
              kicker: 'Evolução',
              title: 'Progressão',
              sub: 'Cargas e evolução por exercício.',
            }
          : idleView === 'history'
            ? {
                kicker: 'Sessões',
                title: 'Histórico',
                sub: 'Todas as sessões recentes — toca para ver as séries.',
              }
            : null
  const restSeconds = state.settings.restSeconds
  const restTimerEnabled = state.settings.restTimerEnabled
  const instructorMode = state.settings.instructorMode
  const instructorQuickMode = state.settings.instructorQuickMode
  const treinoLog = useMemo(
    () => treinoDayLog(state.history),
    [state.history],
  )
  const todayDow = new Date().getDay()
  const currentPreset = state.activePresetId
    ? getPresetById(state.activePresetId)
    : null
  const currentSavedPlan = state.activeSavedPlanId
    ? (state.savedPlans ?? []).find((p) => p.id === state.activeSavedPlanId)
    : null

  const selectedDay = useMemo(
    () => days.find((d) => dateKey(d) === selectedDayKey) ?? days.find((d) => dateKey(d) === todayKey) ?? days[0],
    [days, selectedDayKey, todayKey],
  )

  const selectedDayInfo = useMemo(() => {
    const key = dateKey(selectedDay)
    const template = plan.find((t) => t.dayOfWeek === selectedDay.getDay()) ?? null
    const done = Boolean(state.weekDone[key])
    const sessions = state.history.filter((w) => w.dateKey === key)
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    const dayNoon = new Date(selectedDay)
    dayNoon.setHours(12, 0, 0, 0)
    const isPast = dayNoon < today && key !== todayKey
    const isFuture = dayNoon > today
    const isToday = key === todayKey
    return {
      key,
      template,
      done,
      sessions,
      isPast,
      isFuture,
      isToday,
      isRest: !template,
    }
  }, [selectedDay, plan, state.weekDone, state.history, todayKey])

  const doneTemplateIdsThisWeek = useMemo(() => {
    const weekKeys = new Set(days.map((d) => dateKey(d)))
    const ids = new Set<string>()
    for (const [key, templateId] of Object.entries(state.weekDone)) {
      if (weekKeys.has(key) && templateId) ids.add(templateId)
    }
    for (const session of state.history) {
      if (
        session.templateId &&
        session.completedAt &&
        weekKeys.has(session.dateKey)
      ) {
        ids.add(session.templateId)
      }
    }
    return ids
  }, [days, state.weekDone, state.history])

  const missedWorkouts = useMemo(() => {
    return plan
      .filter((t) => {
        if (t.dayOfWeek >= todayDow) return false
        return !doneTemplateIdsThisWeek.has(t.id)
      })
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
  }, [plan, todayDow, doneTemplateIdsThisWeek])

  useEffect(() => {
    if (!active) setInSession(false)
  }, [active])

  useEffect(() => {
    if (showPanel || showSession || showSummary) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [showPanel, showSession, showSummary, idleView])

  useEffect(() => {
    if (!active) {
      setExpanded(null)
      setRest(null)
      setEffortPrompt(null)
      return
    }
    if (inSession && !expanded) {
      setExpanded(firstIncompleteExerciseId(active))
    }
  }, [active?.startedAt, inSession])

  function firstIncompleteExerciseId(workout: ActiveWorkout) {
    const pending = workout.exercises.find((ex) =>
      ex.sets.some((s) => !s.done),
    )
    return (
      pending?.id ??
      workout.exercises[workout.exercises.length - 1]?.id ??
      null
    )
  }

  function handleToggleSet(exercise: Exercise, setId: string, wasDone: boolean) {
    toggleSet(exercise.id, setId)
    if (!wasDone) {
      if (restTimerEnabled) {
        setRest({ key: Date.now(), seconds: restSeconds })
      }
      const remaining = exercise.sets.filter(
        (s) => s.id !== setId && !s.done,
      ).length
      const doneCountAfter =
        exercise.sets.filter((s) => s.done || s.id === setId).length
      const exerciseDone = remaining === 0
      if (
        instructorMode &&
        exercise.muscle !== 'cardio' &&
        shouldAskInstructor(doneCountAfter, remaining, instructorQuickMode)
      ) {
        const lastWeight = lastSessionMaxWeight(
          state.history,
          exercise.sourceId,
          exercise.name,
          active?.startedAt,
        )
        setEffortPrompt({
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          lastWeight,
        })
      }
      if (exerciseDone && active) {
        const idx = active.exercises.findIndex((e) => e.id === exercise.id)
        const next = idx >= 0 ? active.exercises[idx + 1] : null
        if (next) {
          setExpanded(next.id)
          toast(`Segue: ${next.name}`, 'ok')
        } else {
          setExpanded(exercise.id)
          toast('Último exercício — podes concluir o treino', 'info')
        }
      } else {
        setExpanded(exercise.id)
      }
    }
  }

  function handleInstructorEffort(effort: EffortLevel) {
    if (!effortPrompt) return
    const adjust = applyInstructorEffort(effortPrompt.exerciseId, effort)
    setEffortPrompt(null)
    if (!adjust) return
    toast(instructorTip(effort, adjust), effort === 'hard' ? 'warn' : 'ok')
  }

  function handleStart(template: WorkoutTemplate) {
    setIdleView('plan')
    clearSummary()
    setRest(null)
    startWorkout(template)
    setInSession(true)
    toast('Treino iniciado', 'ok')
  }

  async function requestStart(template: WorkoutTemplate) {
    const today = new Date().getDay()
    if (template.dayOfWeek !== today) {
      const planned = DAY_NAMES[template.dayOfWeek]
      const actual = DAY_NAMES[today]
      const ok = await confirm({
        title: 'Treino de outro dia',
        message: `Tens a certeza que queres fazer o treino de ${planned} na ${actual}?`,
        confirmLabel: 'Sim, iniciar',
        cancelLabel: 'Cancelar',
      })
      if (!ok) return
    }
    handleStart(template)
  }

  function goToOverview() {
    setInSession(false)
    setIdleView('plan')
    setRest(null)
    toast('Progresso guardado — podes continuar quando quiseres', 'info')
  }

  function closePanel() {
    if (showSummary) {
      clearSummary()
      setIdleView('plan')
      return
    }
    if (idleView === 'edit') {
      handleEditorCancel()
      return
    }
    setIdleView('plan')
  }

  function resumeSession() {
    setIdleView('plan')
    if (active) {
      setExpanded(firstIncompleteExerciseId(active))
    }
    setInSession(true)
  }

  function openEditor() {
    setEditSnapshot({
      plan: clonePlan(plan),
      activePresetId: state.activePresetId,
      activeSavedPlanId: state.activeSavedPlanId,
    })
    setIdleView('edit')
  }

  function openCustomPlanBuilder() {
    setEditSnapshot({
      plan: clonePlan(plan),
      activePresetId: state.activePresetId,
      activeSavedPlanId: state.activeSavedPlanId,
    })
    startBlankCustomPlan()
    setIdleView('edit')
    toast('Monta os teus dias — escolhe o tipo de treino em cada um', 'info')
  }

  function handleEditorDone() {
    setEditSnapshot(null)
    setIdleView('plan')
  }

  function handleEditorCancel() {
    if (editSnapshot) restorePlanEdit(editSnapshot)
    setEditSnapshot(null)
    setIdleView('plan')
  }

  async function handleDiscard() {
    const ok = await confirm({
      title: 'Descartar treino?',
      message: 'O progresso desta sessão será perdido.',
      confirmLabel: 'Descartar',
    })
    if (!ok) return
    discardWorkout()
    toast('Treino descartado', 'info')
  }

  async function handleComplete() {
    if (!active || stats.doneSets === 0) return
    let syncStructure = false
    if (active.structureDirty) {
      syncStructure = await confirm({
        title: 'Atualizar o plano?',
        message:
          'Alteraste exercícios nesta sessão. Queres guardar estas mudanças no plano da semana? Se escolheres manter, o plano fica igual e só regista este treino no histórico.',
        confirmLabel: 'Guardar no plano',
        cancelLabel: 'Manter plano',
        danger: false,
      })
    }
    void runComplete(() => {
      completeWorkout({ syncStructure })
      setInSession(false)
      setIdleView('plan')
      setRest(null)
      toast(
        syncStructure
          ? 'Treino concluído — plano atualizado'
          : 'Treino concluído',
        'ok',
      )
    })
  }

  async function handleRemoveActiveSet(exerciseId: string, setId: string) {
    const ok = await confirm({
      title: 'Excluir série?',
      message: 'Esta série será removida do exercício.',
      confirmLabel: 'Excluir',
    })
    if (!ok) return
    removeActiveSet(exerciseId, setId)
    toast('Série excluída', 'info')
  }

  async function handleRemoveActiveExercise(exerciseId: string) {
    if (!active || active.exercises.length <= 1) {
      toast('Mantém pelo menos um exercício', 'warn')
      return
    }
    const ex = active.exercises.find((e) => e.id === exerciseId)
    const ok = await confirm({
      title: 'Remover exercício?',
      message: ex
        ? `“${ex.name}” sai desta sessão. No fim podes escolher se atualizas o plano.`
        : 'Este exercício sai da sessão.',
      confirmLabel: 'Remover',
    })
    if (!ok) return
    removeActiveExercise(exerciseId)
    if (expanded === exerciseId) setExpanded(null)
    toast('Exercício removido da sessão', 'info')
  }

  return (
    <PageTransition>
      <header className="page-header">
        <div>
          <p className="page-kicker">
            {showSession
              ? 'Sessão'
              : (showPanel || showSummary) && panelMeta
                ? panelMeta.kicker
                : 'Corpo'}
          </p>
          <h1 className="page-title">
            {showSession
              ? 'Treino'
              : (showPanel || showSummary) && panelMeta
                ? panelMeta.title
                : 'Treino'}
          </h1>
          {showHome && (
            <p className="page-sub">
              Edita um dia de cada vez. Dias sem treino ficam como descanso
              (sábado e domingo incluídos).
            </p>
          )}
          {(showPanel || showSummary) && panelMeta?.sub && (
            <p className="page-sub">{panelMeta.sub}</p>
          )}
        </div>
        {(showSession || showPanel || showSummary) && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={showSession ? goToOverview : closePanel}
          >
            <ChevronLeft size={16} />
            Voltar
          </button>
        )}
        {showHome && active && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={resumeSession}
          >
            <Play size={16} />
            Continuar
          </button>
        )}
        {showHome && !active && todayTemplate && !isTodayDone && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => requestStart(todayTemplate)}
          >
            <Play size={16} />
            Iniciar hoje
          </button>
        )}
      </header>

      {showHome && (
        <>
          {poorSleepForTraining && (
            <aside className="surface treino-sleep-hint" aria-label="Aviso de sono">
              <Moon size={16} aria-hidden />
              <div>
                <strong>Sono curto ontem</strong>
                <span>
                  {lastNightSleep
                    ? `${lastNightSleep.hours}h — aquecimento extra ou volume reduzido.`
                    : 'Considera aquecimento extra ou volume reduzido.'}
                </span>
              </div>
            </aside>
          )}
          {active && (
            <button
              type="button"
              className="surface surface--interactive treino-resume-banner"
              onClick={resumeSession}
            >
              <ProgressRing value={stats.progress} size={44} stroke={4} />
              <div className="treino-resume-banner__body">
                <p className="page-kicker">Em andamento</p>
                <strong>{active.name}</strong>
                <span>
                  {stats.doneSets}/{stats.totalSets} séries ·{' '}
                  {Math.round(stats.volume)} kg
                </span>
              </div>
              <span className="treino-resume-banner__cta">
                Continuar
                <Play size={14} />
              </span>
            </button>
          )}

          <WeekStrip
            days={days}
            plan={plan}
            weekDone={state.weekDone}
            todayKey={todayKey}
            selectedKey={selectedDayKey}
            onSelectDay={setSelectedDayKey}
          />

          <DayDetail
            day={selectedDay}
            info={selectedDayInfo}
            onStart={(t) => requestStart(t)}
            active={Boolean(active)}
          />

          <motion.div
            className="treino-stats"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
          >
            <StatChip
              icon={<Flame size={16} />}
              label="Semana"
              value={`${stats.weekSessions} sessões`}
            />
            <StatChip
              icon={<Trophy size={16} />}
              label="Volume"
              value={active ? `${Math.round(stats.volume)} kg` : '—'}
            />
            <StatChip
              icon={<Clock size={16} />}
              label="Séries"
              value={
                active ? `${stats.doneSets}/${stats.totalSets}` : '—'
              }
            />
          </motion.div>

          <ActivityHeatmap
            log={treinoLog}
            range="month"
            title="Treinos no mês"
          />
        </>
      )}

      <AnimatePresence mode="wait">
        {showSession && active ? (
          <motion.div
            key="session"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="surface treino-active-head">
              <div className="treino-active-head__main">
                <div className="treino-active-head__left">
                  <ProgressRing value={stats.progress} size={88} stroke={7} />
                  <div>
                    <p className="page-kicker">Em andamento</p>
                    <h2 className="treino-active-title">{active.name}</h2>
                    <p className="treino-active-focus">{active.focus}</p>
                  </div>
                </div>
                <div className="treino-active-head__actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={handleDiscard}
                    title="Descartar"
                  >
                    <X size={16} />
                    Descartar
                  </button>
                  <Button
                    variant="primary"
                    icon={<Check size={16} />}
                    onClick={handleComplete}
                    disabled={stats.doneSets === 0}
                    loading={completing}
                    loadingLabel="A concluir…"
                  >
                    Concluir
                  </Button>
                </div>
              </div>
            </div>

            <div className="rest-prefs">
              <span>Descanso</span>
              <div className="rest-prefs__btns">
                <button
                  type="button"
                  className={`rest-prefs__btn is-off${!restTimerEnabled ? ' is-active' : ''}`}
                  onClick={() => {
                    setRestTimerEnabled(false)
                    setRest(null)
                  }}
                  aria-pressed={!restTimerEnabled}
                >
                  Off
                </button>
                {REST_PRESETS.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    className={`rest-prefs__btn${restTimerEnabled && restSeconds === sec ? ' is-active' : ''}`}
                    onClick={() => {
                      setRestTimerEnabled(true)
                      setRestSeconds(sec)
                    }}
                    aria-pressed={restTimerEnabled && restSeconds === sec}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>

            <div className="section-label">
              <h2>Exercícios</h2>
              <div className="treino-section-actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setPicker({ mode: 'add' })}
                >
                  <Plus size={16} />
                  Adicionar
                </button>
              </div>
            </div>

            {active.structureDirty && (
              <p className="treino-session-hint">
                Alteraste a lista desta sessão. Ao concluir, podes guardar no
                plano ou manter o plano atual.
              </p>
            )}

            <motion.div
              className="treino-exercises"
              variants={staggerContainer}
              initial="hidden"
              animate="show"
            >
              {active.exercises.map((ex, index) => {
                const done = ex.sets.filter((s) => s.done).length
                const open = expanded === ex.id
                const suggestion = suggestionFor(ex)
                return (
                  <motion.div
                    key={ex.id}
                    className={`surface treino-ex${open ? ' is-open' : ''}`}
                    variants={staggerItem}
                  >
                    <button
                      type="button"
                      className="treino-ex__header"
                      onClick={() => setExpanded(open ? null : ex.id)}
                      aria-expanded={open}
                    >
                      <span className="treino-ex__index">{index + 1}</span>
                      <span className="treino-ex__info">
                        <strong>{ex.name}</strong>
                        <span>
                          {ex.muscle}
                          {ex.muscle === 'cardio'
                            ? ` · ${ex.sets.reduce((s, set) => s + set.reps, 0)} min alvo`
                            : ''}
                          {ex.notes ? ` · ${ex.notes}` : ''}
                        </span>
                      </span>
                      <span className="treino-ex__progress">
                        {done}/{ex.sets.length}
                      </span>
                      <ChevronDown
                        size={18}
                        className={`treino-ex__chevron${open ? ' is-open' : ''}`}
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          className="treino-ex__body"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{
                            duration: 0.28,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                        >
                          <div className="treino-ex__session-ops">
                            <button
                              type="button"
                              className="btn btn--ghost"
                              onClick={() =>
                                setPicker({ mode: 'swap', exerciseId: ex.id })
                              }
                            >
                              <ArrowLeftRight size={14} />
                              Trocar
                            </button>
                            <button
                              type="button"
                              className="btn btn--ghost is-danger-ghost"
                              onClick={() =>
                                void handleRemoveActiveExercise(ex.id)
                              }
                              disabled={active.exercises.length <= 1}
                            >
                              <Trash2 size={14} />
                              Remover
                            </button>
                          </div>

                          {suggestion && ex.muscle !== 'cardio' && (
                            <button
                              type="button"
                              className="treino-suggest"
                              onClick={() =>
                                applySuggestedWeight(ex.id, suggestion.weight)
                              }
                            >
                              <Sparkles size={14} />
                              {suggestion.label}
                            </button>
                          )}

                          <div className="treino-sets">
                            {ex.sets.map((set, setIndex) => (
                              <div
                                key={set.id}
                                className={`treino-set${set.done ? ' is-done' : ''}`}
                              >
                                <button
                                  type="button"
                                  className="treino-set__check"
                                  onClick={() =>
                                    handleToggleSet(ex, set.id, set.done)
                                  }
                                  aria-label={
                                    ex.muscle === 'cardio'
                                      ? `Intervalo ${setIndex + 1}`
                                      : `Série ${setIndex + 1}`
                                  }
                                >
                                  {set.done ? (
                                    <Check size={14} strokeWidth={3} />
                                  ) : (
                                    <span>{setIndex + 1}</span>
                                  )}
                                </button>
                                {ex.muscle === 'cardio' ? (
                                  <label className="treino-set__field treino-set__field--grow">
                                    <span>Minutos alvo</span>
                                    <SetNumberInput
                                      value={set.reps}
                                      min={1}
                                      step={1}
                                      onCommit={(reps) =>
                                        updateSet(ex.id, set.id, {
                                          reps,
                                          weight: 0,
                                        })
                                      }
                                    />
                                  </label>
                                ) : (
                                  <>
                                    <label className="treino-set__field">
                                      <span>Reps</span>
                                      <SetNumberInput
                                        value={set.reps}
                                        min={0}
                                        step={1}
                                        onCommit={(reps) =>
                                          updateSet(ex.id, set.id, { reps })
                                        }
                                      />
                                    </label>
                                    <label className="treino-set__field">
                                      <span>Carga</span>
                                      <SetNumberInput
                                        value={set.weight}
                                        min={0}
                                        step={0.5}
                                        onCommit={(weight) =>
                                          updateSet(ex.id, set.id, { weight })
                                        }
                                      />
                                    </label>
                                  </>
                                )}
                                <button
                                  type="button"
                                  className="treino-set__remove"
                                  onClick={() =>
                                    handleRemoveActiveSet(ex.id, set.id)
                                  }
                                  disabled={ex.sets.length <= 1}
                                  title="Remover série"
                                >
                                  <Minus size={14} />
                                </button>
                              </div>
                            ))}
                          </div>

                          <button
                            type="button"
                            className="btn btn--ghost treino-add-set"
                            onClick={() => addActiveSet(ex.id)}
                          >
                            <Plus size={14} />
                            {ex.muscle === 'cardio' ? 'Intervalo' : 'Série'}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </motion.div>
          </motion.div>
        ) : showSummary && lastSummary ? (
          <motion.div
            key="summary"
            className="treino-panel"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <WorkoutSummaryCard
              summary={lastSummary}
              onClose={() => {
                clearSummary()
                setIdleView('plan')
              }}
            />
          </motion.div>
        ) : showPanel ? (
          <motion.div
            key={`panel-${idleView}`}
            className="treino-panel"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {idleView === 'edit' ? (
              <PlanEditor
                plan={plan}
                activeSavedPlanId={state.activeSavedPlanId}
                onUpdateTemplate={updateTemplate}
                onAddTemplate={addTemplate}
                onRemoveTemplate={removeTemplate}
                onAddExercise={addExercise}
                onUpdateExercise={updateExercise}
                onRemoveExercise={removeExercise}
                onAddSet={addTemplateSet}
                onRemoveSet={removeTemplateSet}
                onUpdateSet={updateTemplateSet}
                onReset={resetPlan}
                onSavePlan={saveCurrentPlan}
                onUpdateSavedPlan={updateSavedPlanFromCurrent}
                onDone={handleEditorDone}
                onCancel={handleEditorCancel}
              />
            ) : idleView === 'presets' ? (
              <PlanPresets
                activePresetId={state.activePresetId}
                activeSavedPlanId={state.activeSavedPlanId}
                savedPlans={state.savedPlans ?? []}
                onApply={(id) => {
                  applyPreset(id)
                  toast('Plano aplicado', 'ok')
                }}
                onApplySaved={applySavedPlan}
                onRemoveSaved={removeSavedPlan}
                onCreateCustom={openCustomPlanBuilder}
                onDone={() => setIdleView('plan')}
              />
            ) : idleView === 'history' ? (
              <HistoryList history={state.history} />
            ) : (
              <ProgressionPanel
                items={progression}
                history={state.history}
              />
            )}
          </motion.div>
        ) : showHome ? (
          <motion.div
            key="home-plan"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
                {isTodayDone ? (
                  <div className="surface treino-done-banner">
                    <div className="treino-done-banner__icon">
                      <Trophy size={26} />
                    </div>
                    <div>
                      <h2>Treino de hoje concluído</h2>
                      <p>
                        Cargas salvas no plano — amanhã já vêm pré-preenchidas.
                      </p>
                    </div>
                    {todayTemplate && (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => requestStart(todayTemplate)}
                      >
                        <RotateCcw size={16} />
                        Refazer
                      </button>
                    )}
                  </div>
                ) : null}

                <div className="section-label">
                  <h2>Plano da semana</h2>
                </div>

                <div className="treino-plan-toolbar" role="toolbar" aria-label="Ações do plano">
                  <button
                    type="button"
                    className="treino-plan-toolbar__btn"
                    onClick={() => setIdleView('presets')}
                  >
                    <LayoutTemplate size={16} />
                    <span>Planos</span>
                  </button>
                  <button
                    type="button"
                    className="treino-plan-toolbar__btn"
                    onClick={() => setIdleView('progress')}
                  >
                    <LineChart size={16} />
                    <span>Progressão</span>
                  </button>
                  <button
                    type="button"
                    className="treino-plan-toolbar__btn"
                    onClick={openEditor}
                  >
                    <Pencil size={16} />
                    <span>Editar</span>
                  </button>
                </div>

                <p className="treino-plan-hint">
                  {currentSavedPlan
                    ? `Plano atual: ${currentSavedPlan.name} (teu). `
                    : currentPreset
                      ? `Plano atual: ${currentPreset.name}. `
                      : 'Plano personalizado. '}
                  Usa <em>Editar</em> para montar e <em>Guardar plano</em>, ou{' '}
                  <em>Planos</em> para trocar.
                </p>

                <motion.div
                  className="treino-plan"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                >
                  {plan
                    .slice()
                    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                    .map((template) => {
                      const isToday =
                        template.dayOfWeek === new Date().getDay()
                      const isDone = doneTemplateIdsThisWeek.has(template.id)
                      const cardioMins = template.exercises
                        .filter((e) => e.muscle === 'cardio')
                        .reduce(
                          (sum, e) =>
                            sum + e.sets.reduce((s, set) => s + set.reps, 0),
                          0,
                        )
                      const statusLabel = isDone
                        ? 'Feito'
                        : isToday
                          ? 'Hoje'
                          : null
                      return (
                        <motion.button
                          key={template.id}
                          type="button"
                          className={[
                            'surface',
                            'surface--interactive',
                            'treino-plan-card',
                            isToday ? 'is-today' : '',
                            isDone ? 'is-done' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          variants={staggerItem}
                          onClick={() => requestStart(template)}
                        >
                          <span className="treino-plan-card__day-badge">
                            {DAY_LABELS[template.dayOfWeek]}
                          </span>
                          <span className="treino-plan-card__compact-main">
                            <strong className="treino-plan-card__title">
                              {template.name}
                            </strong>
                            <span className="treino-plan-card__meta">
                              {statusLabel ? `${statusLabel} · ` : ''}
                              {template.estimatedMin} min · {template.exercises.length} ex.
                              {cardioMins > 0 ? ` · ${cardioMins} min cardio` : ''}
                            </span>
                          </span>
                          <span
                            className={`treino-plan-card__compact-action${isDone ? ' is-done' : ''}`}
                            aria-hidden
                          >
                            {isDone ? (
                              <Check size={13} strokeWidth={2.75} />
                            ) : (
                              <Play size={12} fill="currentColor" />
                            )}
                          </span>
                        </motion.button>
                      )
                    })}

                  <motion.button
                    type="button"
                    className="surface surface--interactive treino-plan-card treino-plan-card--add"
                    variants={staggerItem}
                    onClick={openEditor}
                  >
                    <span className="treino-plan-card__day-badge treino-plan-card__day-badge--add">
                      <Plus size={16} strokeWidth={2.5} />
                    </span>
                    <span className="treino-plan-card__compact-main">
                      <strong className="treino-plan-card__title">
                        Adicionar treino
                      </strong>
                      <span className="treino-plan-card__meta">
                        Dia livre ou novo tipo
                      </span>
                    </span>
                  </motion.button>
                </motion.div>

                {state.history.length > 0 && (
                  <>
                    <div className="section-label">
                      <h2>Histórico recente</h2>
                      <span>
                        {state.history.length > 6
                          ? `6 de ${state.history.length}`
                          : `${state.history.length} sessões`}
                      </span>
                    </div>
                    <HistoryList history={state.history} limit={6} />
                    {state.history.length > 6 && (
                      <button
                        type="button"
                        className="btn btn--ghost treino-history-more"
                        onClick={() => setIdleView('history')}
                      >
                        Ver mais
                        <ChevronDown size={16} />
                      </button>
                    )}
                  </>
                )}

                {missedWorkouts.length > 0 && (
                  <div className="surface treino-missed">
                    <div className="treino-missed__head">
                      <div>
                        <p className="page-kicker">Pendentes</p>
                        <h2>Treinos em atraso</h2>
                        <p>Opcional — podes recuperar quando quiseres.</p>
                      </div>
                    </div>
                    <div className="treino-missed__list">
                      {missedWorkouts.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          className="btn btn--ghost treino-missed__btn"
                          onClick={() => requestStart(template)}
                        >
                          <Play size={16} />
                          {DAY_LABELS[template.dayOfWeek]} · {template.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {restTimerEnabled && rest !== null && (
        <RestTimer
          key={rest.key}
          duration={rest.seconds}
          restartKey={rest.key}
          preferredSeconds={restSeconds}
          onPreferredChange={(sec) => {
            setRestSeconds(sec)
            setRest({ key: Date.now(), seconds: sec })
          }}
          onClose={() => setRest(null)}
        />
      )}

      {effortPrompt && (
        <InstructorEffortSheet
          exerciseName={effortPrompt.exerciseName}
          lastWeight={effortPrompt.lastWeight}
          quickMode={instructorQuickMode}
          onPick={handleInstructorEffort}
          onSkip={() => setEffortPrompt(null)}
        />
      )}

      {picker && (
        <ExercisePickerSheet
          title={picker.mode === 'add' ? 'Adicionar exercício' : 'Trocar exercício'}
          confirmLabel={picker.mode === 'add' ? 'Adicionar' : 'Trocar'}
          initial={
            picker.mode === 'swap' && active
              ? (() => {
                  const ex = active.exercises.find(
                    (e) => e.id === picker.exerciseId,
                  )
                  return ex
                    ? { name: ex.name, muscle: ex.muscle }
                    : undefined
                })()
              : undefined
          }
          onCancel={() => setPicker(null)}
          onConfirm={({ name, muscle }) => {
            if (picker.mode === 'add') {
              const id = addActiveExercise({ name, muscle })
              if (id) {
                setExpanded(id)
                toast(`${name} adicionado`, 'ok')
              }
            } else {
              replaceActiveExercise(picker.exerciseId, { name, muscle })
              setExpanded(picker.exerciseId)
              toast(`Trocado para ${name}`, 'ok')
            }
            setPicker(null)
          }}
        />
      )}
    </PageTransition>
  )
}

function WeekStrip({
  days,
  plan,
  weekDone,
  todayKey,
  selectedKey,
  onSelectDay,
}: {
  days: Date[]
  plan: WorkoutTemplate[]
  weekDone: Record<string, string>
  todayKey: string
  selectedKey: string
  onSelectDay: (key: string) => void
}) {
  return (
    <div className="week-strip-wrap">
      <div className="week-strip" role="list" aria-label="Semana de treino">
        {days.map((d) => {
          const key = dateKey(d)
          const template = plan.find((t) => t.dayOfWeek === d.getDay())
          const done = Boolean(weekDone[key])
          const isToday = key === todayKey
          const isSelected = key === selectedKey
          const isRest = !template
          return (
            <button
              key={key}
              type="button"
              role="listitem"
              className={`week-day${isToday ? ' is-today' : ''}${done ? ' is-done' : ''}${template ? ' is-train' : ' is-rest'}${isSelected ? ' is-selected' : ''}`}
              onClick={() => onSelectDay(key)}
              aria-pressed={isSelected}
              aria-label={`${DAY_NAMES[d.getDay()]} — ${isRest ? 'descanso' : 'treino'}`}
            >
              <span className="week-day__label">{DAY_LABELS[d.getDay()]}</span>
              <span className="week-day__num">{d.getDate()}</span>
              <span className={`week-day__tag${isRest ? ' is-rest' : ''}`}>
                {isRest ? 'Folga' : done ? 'Feito' : 'Treino'}
              </span>
            </button>
          )
        })}
      </div>
      <div className="week-strip-legend" aria-hidden="true">
        <span>
          <i className="week-strip-legend__dot is-train" /> Treino
        </span>
        <span>
          <i className="week-strip-legend__dot is-rest" /> Descanso
        </span>
        <span>
          <i className="week-strip-legend__dot is-done" /> Feito
        </span>
      </div>
    </div>
  )
}

function DayDetail({
  day,
  info,
  onStart,
  active,
}: {
  day: Date
  info: {
    key: string
    template: WorkoutTemplate | null
    done: boolean
    sessions: ActiveWorkout[]
    isPast: boolean
    isFuture: boolean
    isToday: boolean
    isRest: boolean
  }
  onStart: (template: WorkoutTemplate) => void
  active: boolean
}) {
  const { template, done, sessions, isPast, isFuture, isToday, isRest } = info
  const whenLabel = isToday
    ? 'Hoje'
    : isPast
      ? 'Dia passado'
      : 'Ainda por vir'

  let statusText = 'Descanso'
  if (template) {
    if (done || sessions.length > 0) statusText = 'Treino feito'
    else if (isPast) statusText = 'Treino em atraso'
    else if (isToday) statusText = 'Treino de hoje'
    else statusText = 'Treino planeado'
  } else if (sessions.length > 0) {
    statusText = 'Treino extra feito'
  }

  return (
    <div className="surface day-detail">
      <div className="day-detail__head">
        <div>
          <p className="page-kicker">
            {whenLabel} · {info.key}
          </p>
          <h2>{DAY_NAMES[day.getDay()]}</h2>
        </div>
        <span
          className={`day-detail__badge${isRest && sessions.length === 0 ? ' is-rest' : ''}${done || sessions.length > 0 ? ' is-done' : ''}${!isRest && isPast && !done && sessions.length === 0 ? ' is-missed' : ''}`}
        >
          {isRest && sessions.length === 0 ? (
            <Moon size={14} />
          ) : (
            <Dumbbell size={14} />
          )}
          {statusText}
        </span>
      </div>

      {isRest && sessions.length === 0 ? (
        <p className="day-detail__copy">
          {isFuture || isToday
            ? 'Dia de descanso no teu plano. Sem treino marcado.'
            : 'Foi um dia de descanso — sem sessão registada.'}
        </p>
      ) : null}

      {template && (
        <div className="day-detail__plan">
          <strong>{template.name}</strong>
          <span>
            {template.focus || 'Sem foco'} · {template.exercises.length}{' '}
            exercícios · ~{template.estimatedMin} min
          </span>
          {!active && (isToday || isPast || isFuture) && (
            <button
              type="button"
              className="btn btn--primary day-detail__cta"
              onClick={() => onStart(template)}
            >
              <Play size={16} />
              {done || sessions.length > 0
                ? 'Treinar de novo'
                : isPast
                  ? 'Recuperar agora'
                  : isToday
                    ? 'Iniciar'
                    : 'Treinar já'}
            </button>
          )}
        </div>
      )}

      {sessions.length > 0 ? (
        <div className="day-detail__history">
          <p className="page-kicker">O que treinaste</p>
          {sessions.map((w) => {
            const sets = workoutSetsDone(w)
            const vol = Math.round(workoutVolume(w))
            return (
              <div key={w.startedAt} className="day-detail__session">
                <strong>{w.name}</strong>
                <span>
                  {sets} séries · {vol} kg vol. ·{' '}
                  {w.exercises.filter((e) => e.sets.some((s) => s.done)).length}{' '}
                  exercícios
                </span>
              </div>
            )
          })}
        </div>
      ) : isPast && template && !done ? (
        <p className="day-detail__copy day-detail__copy--warn">
          Tinhas treino marcado e não ficou registado. Podes recuperar agora.
        </p>
      ) : isFuture && template ? (
        <p className="day-detail__copy">
          Vais treinar este dia. Se quiseres, podes adiantar a sessão já.
        </p>
      ) : null}
    </div>
  )
}

function StatChip({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="surface treino-stat">
      <span className="treino-stat__icon">{icon}</span>
      <div>
        <p className="page-kicker">{label}</p>
        <strong>{value}</strong>
      </div>
    </div>
  )
}

/** Permite campo vazio ao apagar; no blur vazio → 0. */
function SetNumberInput({
  value,
  min = 0,
  step = 1,
  onCommit,
}: {
  value: number
  min?: number
  step?: number
  onCommit: (n: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(String(value))
  }, [value, focused])

  function commit(raw: string) {
    const trimmed = raw.trim().replace(',', '.')
    if (trimmed === '' || trimmed === '-' || trimmed === '.') {
      onCommit(min)
      setDraft(String(min))
      return
    }
    const n = Number(trimmed)
    if (!Number.isFinite(n) || n < min) {
      onCommit(min)
      setDraft(String(min))
      return
    }
    onCommit(n)
    setDraft(String(n))
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={focused ? draft : String(value)}
      onFocus={() => {
        setFocused(true)
        setDraft(value === 0 ? '' : String(value))
      }}
      onChange={(e) => {
        const next = e.target.value.replace(/[^\d.,]/g, '')
        setDraft(next)
        if (next.trim() === '') return
        const n = Number(next.replace(',', '.'))
        if (Number.isFinite(n) && n >= min) onCommit(n)
      }}
      onBlur={() => {
        setFocused(false)
        commit(draft)
      }}
      step={step}
    />
  )
}
