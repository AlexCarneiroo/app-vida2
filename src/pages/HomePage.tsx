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
import { useMemo, useState, type CSSProperties } from 'react'
import {
  PageTransition,
  staggerContainer,
  staggerItem,
} from '../components/ui/PageTransition'
import { ProgressRing } from '../components/ui/ProgressRing'
import { useTreino } from '../hooks/useTreino'

const baseModules = [
  {
    to: '/financas',
    title: 'Finanças',
    desc: 'Fluxo, metas e clareza',
    meta: 'Mês',
    progress: 48,
    icon: PiggyBank,
    bar: 'var(--financas)',
    iconBg: 'rgba(240, 199, 94, 0.16)',
    iconFg: 'var(--financas)',
  },
  {
    to: '/habitos',
    title: 'Hábitos',
    desc: 'Consistência que compõe',
    meta: '4/6',
    progress: 78,
    icon: Sparkles,
    bar: 'var(--habitos)',
    iconBg: 'rgba(196, 164, 132, 0.16)',
    iconFg: 'var(--habitos)',
  },
  {
    to: '/rotina',
    title: 'Rotina',
    desc: 'O dia em ritmo certo',
    meta: '3 blocos',
    progress: 35,
    icon: Repeat,
    bar: 'var(--rotina)',
    iconBg: 'rgba(126, 184, 255, 0.16)',
    iconFg: 'var(--rotina)',
  },
] as const

const initialHabits = [
  { id: 1, name: 'Água 2L', detail: 'Manhã · tarde', streak: 12, done: true },
  { id: 2, name: 'Leitura 20 min', detail: 'Noite', streak: 8, done: true },
  { id: 3, name: 'Sem redes até 10h', detail: 'Foco', streak: 5, done: false },
  { id: 4, name: 'Alongamento', detail: 'Pós-treino', streak: 3, done: false },
]

export function HomePage() {
  const [habits, setHabits] = useState(initialHabits)
  const {
    todayTemplate,
    isTodayDone,
    state,
    stats,
  } = useTreino()

  const doneCount = habits.filter((h) => h.done).length
  const dayProgress = Math.round((doneCount / habits.length) * 100)

  const treinoMeta = isTodayDone
    ? 'Feito'
    : state.active
      ? `${stats.progress}%`
      : todayTemplate
        ? 'Hoje'
        : 'Descanso'

  const treinoDesc = state.active
    ? `Em andamento · ${stats.doneSets}/${stats.totalSets} séries`
    : isTodayDone
      ? 'Sessão concluída'
      : todayTemplate
        ? todayTemplate.focus
        : 'Sem treino no plano'

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
      ...baseModules,
    ],
    [treinoDesc, treinoMeta, stats.homeProgress],
  )

  function toggleHabit(id: number) {
    setHabits((prev) =>
      prev.map((h) => (h.id === id ? { ...h, done: !h.done } : h)),
    )
  }

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
          {doneCount}/{habits.length} feitos
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
              Ritmo em construção
            </strong>
            <p
              style={{
                color: 'var(--ink-muted)',
                marginTop: '0.35rem',
                fontSize: '0.9rem',
              }}
            >
              Marque os hábitos — o anel acompanha em tempo real.
            </p>
          </div>
        </div>

        <div className="surface habit-list">
          {habits.map((habit) => (
            <button
              key={habit.id}
              type="button"
              className="habit-row"
              onClick={() => toggleHabit(habit.id)}
            >
              <span className={`habit-check${habit.done ? ' is-done' : ''}`}>
                {habit.done && <Check size={16} strokeWidth={3} />}
              </span>
              <span className="habit-info">
                <strong>{habit.name}</strong>
                <span>{habit.detail}</span>
              </span>
              <span className="streak">{habit.streak}d</span>
            </button>
          ))}
        </div>
      </motion.div>
    </PageTransition>
  )
}
