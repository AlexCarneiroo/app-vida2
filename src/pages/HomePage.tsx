import { Link } from 'react-router-dom'
import {
  Activity,
  Check,
  Dumbbell,
  Gamepad2,
  PiggyBank,
  Play,
  Repeat,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { PageTransition } from '../components/ui/PageTransition'
import { ProgressRing } from '../components/ui/ProgressRing'
import { ActivityHeatmap } from '../components/ui/ActivityHeatmap'
import { useAuth } from '../hooks/useAuth'
import { useFinancas } from '../hooks/useFinancas'
import { useHabitos } from '../hooks/useHabitos'
import { useNutricao } from '../hooks/useNutricao'
import { useRotina } from '../hooks/useRotina'
import { useJogos } from '../hooks/useJogos'
import { useSaude } from '../hooks/useSaude'
import { useTreino } from '../hooks/useTreino'
import { coachLine } from '../hooks/useMotivation'
import { buildInstructorHomeNote } from '../components/treino/InstructorHomeNote'
import {
  financasDayLog,
  mergeDayLogs,
  treinoDayLog,
} from '../lib/activityHeatmap'
import { daysUntilBill } from '../lib/billStatus'
import { dateKey, formatBRL, weekDates } from '../lib/date'

/** Bom dia 5–11 · Boa tarde 12–17 · Boa noite 18–4 */
function greetingForHour(hour: number) {
  if (hour >= 5 && hour < 12) return 'Bom dia'
  if (hour >= 12 && hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function HomePage() {
  const { profile } = useAuth()
  const {
    todayTemplate,
    isTodayDone,
    state,
    stats,
    plan,
  } = useTreino()
  const instructorMode = state.settings.instructorMode
  const {
    dueToday,
    doneCount,
    coveredCount,
    total: habitsTotal,
    toggleHabit,
    dayLog: habitsLog,
  } = useHabitos()
  const {
    blocks,
    doneCount: rotinaDone,
    total: rotinaTotal,
    toggleBlock,
    dayLog: rotinaLog,
  } = useRotina()
  const {
    stats: financeStats,
    monthTransactions,
    state: financeState,
    monthLabel,
    billsOverdue,
    billsDueSoonAlert,
  } = useFinancas()
  const { todayMacros, todayEntries, state: nutriState } = useNutricao()
  const {
    score: saudeScore,
    signals: saudeSignals,
    dueExams,
    sleepDebt,
    poorSleepForTraining,
    state: saudeState,
    today: saudeToday,
  } = useSaude()
  const { playsToday: jogosPlaysToday, streak: jogosStreak } = useJogos()
  const nutriLog = nutriState.dayLog ?? {}
  const goals = financeState.goals

  const activityLog = useMemo(
    () =>
      mergeDayLogs(
        habitsLog,
        rotinaLog,
        nutriLog,
        treinoDayLog(state.history),
        financasDayLog(financeState.transactions),
      ),
    [habitsLog, rotinaLog, nutriLog, state.history, financeState.transactions],
  )

  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = () => setNow(new Date())
    const id = window.setInterval(tick, 60_000)
    const onFocus = () => tick()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const greet = greetingForHour(now.getHours())

  const firstName = useMemo(() => {
    const raw = (profile?.displayName || '').trim()
    if (!raw) return null
    return raw.split(/\s+/)[0]
  }, [profile?.displayName])

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      }).format(now),
    [now],
  )

  const treinoPoints =
    todayTemplate || state.active || isTodayDone ? 1 : 0
  const treinoDonePoints = isTodayDone || (state.active && stats.progress >= 100) ? 1 : state.active ? stats.progress / 100 : 0

  const nutriGoal = Math.max(1, nutriState.kcalGoal)
  const dayParts = [
    { total: habitsTotal, done: coveredCount },
    { total: rotinaTotal, done: rotinaDone },
    { total: treinoPoints, done: treinoDonePoints },
    ...(todayEntries.length > 0
      ? [{ total: 1, done: Math.min(1, todayMacros.kcal / nutriGoal) }]
      : []),
  ]
  const dayTotal = dayParts.reduce((a, p) => a + p.total, 0)
  const dayDone = dayParts.reduce((a, p) => a + p.done, 0)
  const dayProgress =
    dayTotal > 0 ? Math.round((dayDone / dayTotal) * 100) : 0

  const treinoMeta = isTodayDone
    ? 'Feito'
    : state.active
      ? `${stats.progress}%`
      : todayTemplate
        ? 'Hoje'
        : '—'

  const financasMeta =
    monthTransactions.length > 0
      ? formatBRL(financeStats.balance)
      : goals.length > 0
        ? `${goals.length} meta${goals.length > 1 ? 's' : ''}`
        : '—'

  const goalsTarget = goals.reduce((a, g) => a + g.target, 0)
  const goalsSaved = goals.reduce((a, g) => a + g.saved, 0)
  const financasProgress =
    goalsTarget > 0
      ? Math.min(100, Math.round((goalsSaved / goalsTarget) * 100))
      : monthTransactions.length > 0 && financeStats.income + financeStats.expense > 0
        ? Math.min(
            100,
            Math.round(
              (financeStats.income /
                (financeStats.income + financeStats.expense)) *
                100,
            ),
          )
        : 0

  const modules = useMemo(
    () => [
      {
        to: '/treino',
        title: 'Treino',
        desc: state.active
          ? 'Sessão em andamento'
          : isTodayDone
            ? 'Concluído hoje'
            : todayTemplate
              ? todayTemplate.name
              : 'Sem plano hoje',
        meta: treinoMeta,
        progress: stats.homeProgress,
        icon: Dumbbell,
        bar: 'var(--treino)',
        iconBg: 'color-mix(in srgb, var(--treino) 16%, transparent)',
        iconFg: 'var(--treino)',
      },
      {
        to: '/financas',
        title: 'Finanças',
        desc:
          monthTransactions.length > 0
            ? `${monthLabel}`
            : 'Sem movimentos',
        meta: financasMeta,
        progress: financasProgress,
        icon: PiggyBank,
        bar: 'var(--financas)',
        iconBg: 'rgba(240, 199, 94, 0.16)',
        iconFg: 'var(--financas)',
      },
      {
        to: '/habitos',
        title: 'Hábitos',
        desc: habitsTotal > 0 ? `${doneCount} de ${habitsTotal} hoje` : 'Nenhum criado',
        meta: habitsTotal > 0 ? `${doneCount}/${habitsTotal}` : '—',
        progress: habitsTotal > 0 ? Math.round((doneCount / habitsTotal) * 100) : 0,
        icon: Sparkles,
        bar: 'var(--habitos)',
        iconBg: 'rgba(196, 164, 132, 0.16)',
        iconFg: 'var(--habitos)',
      },
      {
        to: '/rotina',
        title: 'Rotina',
        desc: rotinaTotal > 0 ? `${rotinaDone} de ${rotinaTotal} blocos` : 'Nenhum bloco',
        meta: rotinaTotal > 0 ? `${rotinaDone}/${rotinaTotal}` : '—',
        progress:
          rotinaTotal > 0
            ? Math.round((rotinaDone / rotinaTotal) * 100)
            : 0,
        icon: Repeat,
        bar: 'var(--rotina)',
        iconBg: 'rgba(126, 184, 255, 0.16)',
        iconFg: 'var(--rotina)',
      },
      {
        to: '/nutricao',
        title: 'Nutrição',
        desc:
          todayMacros.kcal > 0
            ? `${todayMacros.kcal} kcal`
            : 'Diário vazio',
        meta: todayMacros.kcal > 0 ? `${todayMacros.kcal}` : '—',
        progress: Math.min(100, Math.round((todayMacros.kcal / nutriGoal) * 100)),
        icon: UtensilsCrossed,
        bar: 'var(--nutricao)',
        iconBg: 'rgba(242, 166, 90, 0.16)',
        iconFg: 'var(--nutricao)',
      },
      {
        to: '/saude',
        title: 'Saúde',
        desc: saudeSignals.waterOk ? 'Hidratação em dia' : 'Hidratação',
        meta: `${saudeScore}`,
        progress: saudeScore,
        icon: Activity,
        bar: 'var(--saude)',
        iconBg: 'color-mix(in srgb, var(--saude) 16%, transparent)',
        iconFg: 'var(--saude)',
      },
      {
        to: '/jogos',
        title: 'Jogos',
        desc:
          jogosPlaysToday > 0
            ? `${jogosPlaysToday} hoje · ${jogosStreak}d`
            : 'Memória, fala e foco',
        meta: jogosPlaysToday > 0 ? `${jogosPlaysToday}` : '—',
        progress:
          jogosPlaysToday > 0 ? Math.min(100, jogosPlaysToday * 34) : 0,
        icon: Gamepad2,
        bar: 'var(--jogos)',
        iconBg: 'color-mix(in srgb, var(--jogos) 16%, transparent)',
        iconFg: 'var(--jogos)',
      },
    ],
    [
      treinoMeta,
      isTodayDone,
      todayTemplate,
      state.active,
      monthLabel,
      monthTransactions.length,
      stats.homeProgress,
      financasMeta,
      financasProgress,
      habitsTotal,
      doneCount,
      coveredCount,
      rotinaTotal,
      rotinaDone,
      todayMacros,
      nutriGoal,
      saudeScore,
      saudeSignals.waterOk,
      jogosPlaysToday,
      jogosStreak,
    ],
  )

  const heroLine = coachLine({
    hour: now.getHours(),
    firstName,
    dayProgress,
    dayTotal,
    habitPending: dueToday.some((h) => !h.doneToday && !h.skippedToday),
    workoutPending: Boolean(todayTemplate && !isTodayDone && !state.active),
  })

  const missedWorkouts = useMemo(() => {
    const days = weekDates(now)
    const weekKeys = new Set(days.map((d) => dateKey(d)))
    const doneIds = new Set<string>()
    for (const [key, templateId] of Object.entries(state.weekDone)) {
      if (weekKeys.has(key) && templateId) doneIds.add(templateId)
    }
    for (const session of state.history) {
      if (
        session.templateId &&
        session.completedAt &&
        weekKeys.has(session.dateKey)
      ) {
        doneIds.add(session.templateId)
      }
    }
    const todayDow = now.getDay()
    return plan
      .filter((t) => t.dayOfWeek < todayDow && !doneIds.has(t.id))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
  }, [plan, state.weekDone, state.history, now])

  const instructorNote = useMemo(() => {
    if (!instructorMode) return null
    return buildInstructorHomeNote({
      dateKey: dateKey(now),
      firstName,
      todayTemplate,
      todayDone: isTodayDone,
      missed: missedWorkouts,
      activeName: state.active?.name ?? null,
    })
  }, [
    instructorMode,
    now,
    firstName,
    todayTemplate,
    isTodayDone,
    missedWorkouts,
    state.active?.name,
  ])

  const saudeNote = useMemo(() => {
    if (dueExams.length > 0) {
      return dueExams.length === 1
        ? `Exame a refazer: ${dueExams[0].name}.`
        : `${dueExams.length} exames próximos do prazo.`
    }
    if (sleepDebt >= 4) {
      return `Débito de sono ~${sleepDebt}h esta semana.`
    }
    if (poorSleepForTraining) {
      return 'Sono curto ontem — treino leve se precisares.'
    }
    const pendingMeds = saudeState.medications.filter(
      (m) => m.enabled && m.lastTakenDateKey !== saudeToday,
    )
    if (pendingMeds.length > 0) {
      return pendingMeds.length === 1
        ? `Medicação pendente: ${pendingMeds[0].name}.`
        : `${pendingMeds.length} medicações pendentes hoje.`
    }
    return null
  }, [
    dueExams,
    sleepDebt,
    poorSleepForTraining,
    saudeState.medications,
    saudeToday,
  ])

  const billsNote = useMemo(() => {
    if (billsOverdue.length > 0) {
      const names = billsOverdue
        .slice(0, 3)
        .map((b) => b.name)
        .join(', ')
      const more =
        billsOverdue.length > 3 ? ` +${billsOverdue.length - 3}` : ''
      const count =
        billsOverdue.length === 1
          ? '1 conta atrasada'
          : `${billsOverdue.length} contas atrasadas`
      return `${count}: ${names}${more}.`
    }
    if (billsDueSoonAlert.length === 0) return null
    const now = new Date()
    const today = billsDueSoonAlert.filter((b) => daysUntilBill(b, now) === 0)
    const tomorrow = billsDueSoonAlert.filter(
      (b) => daysUntilBill(b, now) === 1,
    )
    if (today.length > 0) {
      return today.length === 1
        ? `Hoje vence ${today[0].name}.`
        : `Hoje vencem ${today.map((b) => b.name).join(', ')}.`
    }
    if (tomorrow.length > 0) {
      return tomorrow.length === 1
        ? `Amanhã vence ${tomorrow[0].name}.`
        : `Amanhã vencem ${tomorrow.map((b) => b.name).join(', ')}.`
    }
    return null
  }, [billsOverdue, billsDueSoonAlert])

  const todayItems = useMemo(() => {
    const list: Array<{
      id: string
      kind: 'habit' | 'rotina'
      title: string
      detail: string
      done: boolean
      streak?: number
      onToggle: () => void
    }> = []

    for (const h of dueToday) {
      list.push({
        id: `h-${h.id}`,
        kind: 'habit',
        title: h.name,
        detail: h.skippedToday
          ? 'Dia difícil · sequência protegida'
          : h.detail || (h.doneToday ? 'Concluído' : 'Pendente'),
        done: h.doneToday || h.skippedToday,
        streak: h.streak,
        onToggle: () => toggleHabit(h.id),
      })
    }
    for (const b of blocks) {
      list.push({
        id: `r-${b.id}`,
        kind: 'rotina',
        title: b.title,
        detail: `${b.time}${b.detail ? ` · ${b.detail}` : ''}`,
        done: b.doneToday,
        onToggle: () => toggleBlock(b.id),
      })
    }
    return list.slice(0, 8)
  }, [dueToday, blocks, toggleHabit, toggleBlock])

  const notices = [
    billsNote
      ? { id: 'bills', text: billsNote, to: '/financas', cta: 'Ver contas' }
      : null,
    saudeNote
      ? { id: 'saude', text: saudeNote, to: '/saude', cta: 'Ver saúde' }
      : null,
    missedWorkouts.length > 0 && instructorNote
      ? {
          id: 'missed',
          text: instructorNote.text,
          to: '/treino',
          cta: instructorNote.cta ?? 'Ver treino',
        }
      : null,
  ]
    .filter((item): item is { id: string; text: string; to: string; cta: string } =>
      Boolean(item),
    )
    .slice(0, 2)

  const lead =
    dayTotal === 0
      ? 'Escolhe uma área para registar o primeiro passo de hoje.'
      : heroLine

  const dateLabel = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)

  return (
    <PageTransition>
      <header className="home-head">
        <div className="home-head__intro">
          <p className="home-head__date">{dateLabel}</p>
          <h1 className="home-head__greet">
            {greet}
            {firstName ? (
              <>
                , <em>{firstName}</em>
              </>
            ) : null}
          </h1>
        </div>
        <div
          className="home-head__meter"
          aria-label={`Progresso do dia ${dayProgress}%`}
        >
          <ProgressRing value={dayProgress} size={58} stroke={5} color="var(--jade)" />
        </div>
      </header>

      <p className="home-lead">{lead}</p>

      {notices.length > 0 && (
        <div className="home-notices">
          {notices.map((note) => (
            <Link key={note.id} to={note.to} className="home-notice">
              <p>{note.text}</p>
              <span>{note.cta}</span>
            </Link>
          ))}
        </div>
      )}

      {(todayTemplate || state.active) && (
        <Link to="/treino" className="surface surface--interactive home-treino-card">
          <span
            className="module-card__icon"
            style={{
              background: 'color-mix(in srgb, var(--treino) 16%, transparent)',
              color: 'var(--treino)',
            }}
          >
            {isTodayDone && !state.active ? (
              <Check size={20} />
            ) : (
              <Play size={20} />
            )}
          </span>
          <div className="home-treino-card__body">
            <p className="page-kicker">
              {state.active
                ? 'Em andamento'
                : isTodayDone
                  ? 'Concluído'
                  : 'Treino de hoje'}
            </p>
            <strong>
              {state.active?.name ?? todayTemplate?.name ?? 'Treino'}
            </strong>
            <span>
              {state.active
                ? `${stats.doneSets}/${stats.totalSets} séries · ${stats.progress}%`
                : todayTemplate
                  ? `~${todayTemplate.estimatedMin} min · ${todayTemplate.exercises.length} exercícios`
                  : ''}
            </span>
          </div>
          <ProgressRing
            value={stats.homeProgress}
            size={56}
            stroke={5}
            color="var(--treino)"
          />
        </Link>
      )}

      <div className="section-label">
        <h2>Áreas</h2>
      </div>

      <div className="home-areas">
        {modules.map((mod) => {
          const Icon = mod.icon
          const meta = mod.meta === '—' ? '' : mod.meta
          return (
            <Link
              key={mod.to}
              to={mod.to}
              className="surface surface--interactive home-area"
              style={
                {
                  '--icon-bg': mod.iconBg,
                  '--icon-fg': mod.iconFg,
                } as CSSProperties
              }
            >
              <span className="home-area__icon">
                <Icon size={18} strokeWidth={2.1} />
              </span>
              <span className="home-area__copy">
                <strong>{mod.title}</strong>
                <em>{mod.desc}</em>
              </span>
              {meta ? <span className="home-area__meta">{meta}</span> : null}
            </Link>
          )
        })}
      </div>

      {todayItems.length > 0 && (
        <>
          <div className="section-label">
            <h2>Hoje</h2>
            <span>
              {todayItems.filter((item) => item.done).length}/{todayItems.length}
            </span>
          </div>
          <div className="surface habit-list">
            {todayItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="habit-row"
                onClick={item.onToggle}
              >
                <span className={`habit-check${item.done ? ' is-done' : ''}`}>
                  {item.done && <Check size={16} strokeWidth={3} />}
                </span>
                <span className="habit-info">
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </span>
                {item.kind === 'habit' && item.streak != null ? (
                  <span className="streak">{item.streak}d</span>
                ) : (
                  <span className="streak">rotina</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      <ActivityHeatmap log={activityLog} range="month" title="Este mês" />
    </PageTransition>
  )
}
