import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowUpRight,
  Check,
  Dumbbell,
  PiggyBank,
  Play,
  Repeat,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  PageTransition,
  staggerContainer,
  staggerItem,
} from '../components/ui/PageTransition'
import { ProgressRing } from '../components/ui/ProgressRing'
import { ActivityHeatmap } from '../components/ui/ActivityHeatmap'
import { useAuth } from '../hooks/useAuth'
import { useFinancas } from '../hooks/useFinancas'
import { useHabitos } from '../hooks/useHabitos'
import { useRotina } from '../hooks/useRotina'
import { useTreino } from '../hooks/useTreino'
import {
  financasDayLog,
  mergeDayLogs,
  treinoDayLog,
} from '../lib/activityHeatmap'
import { formatBRL } from '../lib/date'

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
  } = useTreino()
  const {
    dueToday,
    doneCount,
    coveredCount,
    total: habitsTotal,
    allTotal: habitsAllTotal,
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
  const { stats: financeStats, monthTransactions, state: financeState, monthLabel } =
    useFinancas()
  const goals = financeState.goals

  const activityLog = useMemo(
    () =>
      mergeDayLogs(
        habitsLog,
        rotinaLog,
        treinoDayLog(state.history),
        financasDayLog(financeState.transactions),
      ),
    [habitsLog, rotinaLog, state.history, financeState.transactions],
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

  const dayParts = [
    { total: habitsTotal, done: coveredCount },
    { total: rotinaTotal, done: rotinaDone },
    { total: treinoPoints, done: treinoDonePoints },
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

  const treinoDesc = state.active
    ? `Em andamento · ${stats.doneSets}/${stats.totalSets} séries`
    : isTodayDone
      ? 'Sessão concluída hoje'
      : todayTemplate
        ? `${todayTemplate.name} · ~${todayTemplate.estimatedMin} min`
        : 'Nenhum treino no plano de hoje'

  const financasMeta =
    monthTransactions.length > 0
      ? formatBRL(financeStats.balance)
      : goals.length > 0
        ? `${goals.length} meta${goals.length > 1 ? 's' : ''}`
        : '—'

  const financasDesc =
    monthTransactions.length > 0
      ? `${monthLabel} · ${monthTransactions.length} movimento${monthTransactions.length === 1 ? '' : 's'} · saldo ${formatBRL(financeStats.balance)}`
      : goals.length > 0
        ? goals
            .slice(0, 2)
            .map((g) => g.name)
            .join(' · ')
        : 'Sem movimentos neste mês'

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
        desc: treinoDesc,
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
        desc: financasDesc,
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
        desc:
          habitsTotal > 0
            ? `${doneCount} de ${habitsTotal} feitos hoje`
            : 'Nenhum hábito criado',
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
        desc:
          rotinaTotal > 0
            ? `${rotinaDone} de ${rotinaTotal} blocos feitos`
            : 'Nenhum bloco na rotina',
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
    ],
    [
      treinoDesc,
      treinoMeta,
      stats.homeProgress,
      financasDesc,
      financasMeta,
      financasProgress,
      habitsTotal,
      doneCount,
      coveredCount,
      rotinaTotal,
      rotinaDone,
    ],
  )

  const heroLine =
    dayTotal === 0
      ? 'Escolhe por onde começar — os pilares acompanham o teu dia.'
      : dayProgress >= 100
        ? 'Dia fechado. Mantém o ritmo amanhã.'
        : `${dayProgress}% do dia · ${Math.round(dayDone)} de ${dayTotal} feitos`

  const primaryTreinoLabel = state.active
    ? 'Continuar treino'
    : isTodayDone
      ? 'Ver treino'
      : todayTemplate
        ? 'Treinar hoje'
        : 'Montar treino'

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

  return (
    <PageTransition>
      <motion.section
        className={`home-hero${dayTotal === 0 ? ' home-hero--empty' : ''}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="home-hero__glow" aria-hidden="true" />
        <div className="home-hero__glow home-hero__glow--2" aria-hidden="true" />

        <div className="home-hero__top">
          <div className="home-hero__intro">
            <h1 className="home-hero__greet">
              {greet}
              {firstName ? (
                <>
                  , <em>{firstName}</em>
                </>
              ) : null}
            </h1>
            <p className="home-hero__date">{todayLabel}</p>
          </div>
          <div className="home-hero__meter" aria-label={`Progresso do dia ${dayProgress}%`}>
            <ProgressRing
              value={dayProgress}
              size={76}
              stroke={6}
              color="var(--jade)"
            />
          </div>
        </div>

        {dayTotal > 0 && (
          <span className="home-hero__chip">
            {dayProgress >= 100 ? 'Completo' : 'Em curso'}
          </span>
        )}
        <p className="home-hero__line">{heroLine}</p>

        {dayTotal === 0 ? (
          <div className="home-hero__starts">
            <Link to="/treino" className="home-start">
              <span className="home-start__icon" style={{ color: 'var(--treino)' }}>
                <Dumbbell size={18} />
              </span>
              <span>
                <strong>Treino</strong>
                <em>Definir plano</em>
              </span>
              <ArrowUpRight size={16} />
            </Link>
            <Link to="/habitos" className="home-start">
              <span className="home-start__icon" style={{ color: 'var(--habitos)' }}>
                <Sparkles size={18} />
              </span>
              <span>
                <strong>Hábitos</strong>
                <em>Criar o primeiro</em>
              </span>
              <ArrowUpRight size={16} />
            </Link>
            <Link to="/financas" className="home-start">
              <span className="home-start__icon" style={{ color: 'var(--financas)' }}>
                <PiggyBank size={18} />
              </span>
              <span>
                <strong>Finanças</strong>
                <em>Registar saldo</em>
              </span>
              <ArrowUpRight size={16} />
            </Link>
            <Link to="/rotina" className="home-start">
              <span className="home-start__icon" style={{ color: 'var(--rotina)' }}>
                <Repeat size={18} />
              </span>
              <span>
                <strong>Rotina</strong>
                <em>Blocos do dia</em>
              </span>
              <ArrowUpRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="home-hero__actions">
            <Link to="/treino" className="btn btn--primary">
              {primaryTreinoLabel}
              <ArrowUpRight size={18} />
            </Link>
            <Link
              to={habitsAllTotal === 0 ? '/habitos' : '/rotina'}
              className="btn btn--ghost"
            >
              {habitsAllTotal === 0 ? 'Criar hábitos' : 'Ver rotina'}
            </Link>
          </div>
        )}
      </motion.section>

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
        <h2>Seus pilares</h2>
        <span>Toque para entrar</span>
      </div>

      <motion.div
        className="grid-modules"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {modules.map((mod) => {
          const Icon = mod.icon
          return (
            <motion.div key={mod.to} variants={staggerItem}>
              <Link
                to={mod.to}
                className="surface surface--interactive module-card"
                style={
                  {
                    '--bar': mod.bar,
                    '--icon-bg': mod.iconBg,
                    '--icon-fg': mod.iconFg,
                  } as CSSProperties
                }
              >
                <div className="module-card__top">
                  <span className="module-card__icon">
                    <Icon size={22} strokeWidth={2.1} />
                  </span>
                  <span className="module-card__meta">{mod.meta}</span>
                </div>
                <h3 className="module-card__title">{mod.title}</h3>
                <p className="module-card__desc">{mod.desc}</p>
                <div className="module-card__bar" aria-hidden="true">
                  <motion.span
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: Math.max(0, Math.min(1, mod.progress / 100)) }}
                    transition={{
                      delay: 0.35,
                      duration: 0.8,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
              </Link>
            </motion.div>
          )
        })}
      </motion.div>

      <div className="section-label">
        <h2>Hoje</h2>
        <span>
          {dayTotal > 0
            ? `${Math.round(dayDone)}/${dayTotal}`
            : 'Vazio'}
        </span>
      </div>

      <motion.div
        className="stats-row"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="surface ring-panel">
          <ProgressRing value={dayProgress} color="var(--habitos)" />
          <div>
            <p className="page-kicker">Progresso do dia</p>
            <strong
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.35rem',
                letterSpacing: '-0.03em',
              }}
            >
              {dayTotal === 0
                ? 'Sem itens ainda'
                : dayProgress >= 100
                  ? 'Dia completo'
                  : `${dayProgress}% concluído`}
            </strong>
            <p
              style={{
                color: 'var(--ink-muted)',
                marginTop: '0.35rem',
                fontSize: '0.9rem',
              }}
            >
              {dayTotal === 0
                ? 'Hábitos, rotina e treino de hoje entram neste anel.'
                : [
                    habitsTotal > 0 ? `${doneCount}/${habitsTotal} hábitos` : null,
                    rotinaTotal > 0 ? `${rotinaDone}/${rotinaTotal} rotina` : null,
                    treinoPoints > 0
                      ? isTodayDone
                        ? 'treino feito'
                        : state.active
                          ? `treino ${stats.progress}%`
                          : 'treino por fazer'
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
            </p>
          </div>
        </div>

        <div className="surface habit-list">
          {todayItems.length === 0 ? (
            <Link to="/habitos" className="habit-row home-empty-habits">
              <span className="habit-info">
                <strong>Nada para hoje</strong>
                <span>Adiciona hábitos ou blocos de rotina</span>
              </span>
              <ArrowUpRight size={16} />
            </Link>
          ) : (
            todayItems.map((item) => (
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
                  <span className="streak">{item.kind === 'rotina' ? 'rotina' : ''}</span>
                )}
              </button>
            ))
          )}
        </div>
      </motion.div>

      <ActivityHeatmap log={activityLog} />
    </PageTransition>
  )
}
