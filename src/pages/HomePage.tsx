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
import { useMemo, type CSSProperties } from 'react'
import {
  PageTransition,
  staggerContainer,
  staggerItem,
} from '../components/ui/PageTransition'
import { ProgressRing } from '../components/ui/ProgressRing'
import { useFinancas } from '../hooks/useFinancas'
import { useHabitos } from '../hooks/useHabitos'
import { useRotina } from '../hooks/useRotina'
import { useTreino } from '../hooks/useTreino'
import { formatBRL } from '../lib/date'

export function HomePage() {
  const {
    todayTemplate,
    isTodayDone,
    state,
    stats,
  } = useTreino()
  const { habits, doneCount, total: habitsTotal, toggleHabit } = useHabitos()
  const { doneCount: rotinaDone, total: rotinaTotal } = useRotina()
  const { stats: financeStats, monthTransactions, state: financeState } =
    useFinancas()
  const goals = financeState.goals

  const dayProgress =
    habitsTotal > 0 ? Math.round((doneCount / habitsTotal) * 100) : 0

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
      ? 'Sessão concluída'
      : todayTemplate
        ? todayTemplate.focus
        : 'Sem treino no plano'

  const financasMeta =
    monthTransactions.length > 0
      ? formatBRL(financeStats.balance)
      : goals.length > 0
        ? `${goals.length} meta${goals.length > 1 ? 's' : ''}`
        : 'Vazio'

  const financasProgress =
    goals.length > 0
      ? Math.min(
          100,
          Math.round(
            (goals.reduce((a, g) => a + g.saved, 0) /
              Math.max(
                1,
                goals.reduce((a, g) => a + g.target, 0),
              )) *
              100,
          ),
        )
      : monthTransactions.length > 0
        ? Math.min(100, Math.round((financeStats.expense > 0 ? 55 : 25)))
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
        iconBg: 'rgba(45, 212, 168, 0.16)',
        iconFg: 'var(--treino)',
      },
      {
        to: '/financas',
        title: 'Finanças',
        desc:
          monthTransactions.length > 0
            ? `Saldo do mês · ${formatBRL(financeStats.balance)}`
            : 'Fluxo, metas e clareza',
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
            : 'Consistência que compõe',
        meta: habitsTotal > 0 ? `${doneCount}/${habitsTotal}` : '—',
        progress: dayProgress,
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
            ? `${rotinaDone} de ${rotinaTotal} blocos`
            : 'O dia em ritmo certo',
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
      monthTransactions.length,
      financeStats.balance,
      financasMeta,
      financasProgress,
      habitsTotal,
      doneCount,
      dayProgress,
      rotinaTotal,
      rotinaDone,
    ],
  )

  return (
    <PageTransition>
      <motion.section
        className="home-hero"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="home-hero__pulse" aria-hidden="true" />
        <p className="page-kicker">Desenvolvimento pessoal</p>
        <h1 className="home-hero__brand">VIDA</h1>
        <p className="home-hero__line">
          Treino, dinheiro, hábitos e rotina — um só ritmo para evoluir.
        </p>
        <div className="home-hero__actions">
          <Link to="/treino" className="btn btn--primary">
            {state.active
              ? 'Continuar treino'
              : isTodayDone
                ? 'Ver treino'
                : todayTemplate
                  ? 'Treinar hoje'
                  : 'Abrir treino'}
            <ArrowUpRight size={18} />
          </Link>
          <Link to="/habitos" className="btn btn--ghost">
            Ver hábitos
          </Link>
        </div>
      </motion.section>

      {(todayTemplate || state.active) && (
        <Link to="/treino" className="surface surface--interactive home-treino-card">
          <span
            className="module-card__icon"
            style={{
              background: 'rgba(45, 212, 168, 0.16)',
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
            color="#2dd4a8"
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
                    animate={{ scaleX: mod.progress / 100 }}
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
          {habitsTotal > 0 ? `${doneCount}/${habitsTotal} feitos` : 'Sem hábitos'}
        </span>
      </div>

      <motion.div
        className="stats-row"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="surface ring-panel">
          <ProgressRing value={dayProgress} color="#c4a484" />
          <div>
            <p className="page-kicker">Progresso do dia</p>
            <strong
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.35rem',
                letterSpacing: '-0.03em',
              }}
            >
              {habitsTotal === 0
                ? 'Começa pelos hábitos'
                : doneCount === habitsTotal
                  ? 'Dia completo'
                  : 'Ritmo em construção'}
            </strong>
            <p
              style={{
                color: 'var(--ink-muted)',
                marginTop: '0.35rem',
                fontSize: '0.9rem',
              }}
            >
              {habitsTotal === 0
                ? 'Cria hábitos na aba Hábitos — o anel acompanha aqui.'
                : 'Marca os hábitos — o anel acompanha em tempo real.'}
            </p>
          </div>
        </div>

        <div className="surface habit-list">
          {habits.length === 0 ? (
            <Link to="/habitos" className="habit-row home-empty-habits">
              <span className="habit-info">
                <strong>Nenhum hábito ainda</strong>
                <span>Toca para adicionar o primeiro</span>
              </span>
              <ArrowUpRight size={16} />
            </Link>
          ) : (
            habits.slice(0, 6).map((habit) => (
              <button
                key={habit.id}
                type="button"
                className="habit-row"
                onClick={() => toggleHabit(habit.id)}
              >
                <span
                  className={`habit-check${habit.doneToday ? ' is-done' : ''}`}
                >
                  {habit.doneToday && <Check size={16} strokeWidth={3} />}
                </span>
                <span className="habit-info">
                  <strong>{habit.name}</strong>
                  <span>
                    {habit.detail ||
                      (habit.doneToday ? 'Concluído hoje' : 'Pendente')}
                  </span>
                </span>
                <span className="streak">{habit.streak}d</span>
              </button>
            ))
          )}
        </div>
      </motion.div>
    </PageTransition>
  )
}
