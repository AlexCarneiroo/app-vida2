import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  ChevronDown,
  Flame,
  Minus,
  Sparkles,
  Trophy,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { MUSCLE_LABELS } from '../../data/exerciseLibrary'
import { formatKg } from '../../lib/date'
import type {
  ActiveWorkout,
  ExerciseProgress,
  MuscleGroup,
} from '../../types/treino'

type SortKey = 'delta' | 'name' | 'sessions' | 'weight'
type FilterKey = 'all' | MuscleGroup

type ProgressionPanelProps = {
  items: ExerciseProgress[]
  history?: ActiveWorkout[]
}

function parseBestSet(bestSet: string): { reps: number; weight: number } | null {
  const m = bestSet.match(/(\d+)\s*[x×]\s*([\d.,]+)/i)
  if (!m) return null
  const reps = Number(m[1])
  const weight = Number(m[2].replace(',', '.'))
  if (!Number.isFinite(reps) || !Number.isFinite(weight)) return null
  return { reps, weight }
}

/** Estimativa 1RM (Epley) a partir da melhor série recente. */
function estimate1RM(item: ExerciseProgress) {
  const last = item.sessions[0]
  if (!last || last.maxWeight <= 0) return null
  const parsed = parseBestSet(last.bestSet)
  const reps = parsed?.reps ?? 8
  const weight = parsed?.weight ?? last.maxWeight
  if (reps <= 1) return Math.round(weight)
  return Math.round(weight * (1 + reps / 30))
}

function volumeDeltaPct(item: ExerciseProgress) {
  const a = item.sessions[0]?.volume ?? 0
  const b = item.sessions[1]?.volume ?? 0
  if (b <= 0) return null
  return Math.round(((a - b) / b) * 100)
}

function improveStreak(item: ExerciseProgress) {
  // sessions[0] = mais recente
  let streak = 0
  for (let i = 0; i < item.sessions.length - 1; i++) {
    if (item.sessions[i].maxWeight > item.sessions[i + 1].maxWeight) streak++
    else break
  }
  return streak
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const w = 72
  const h = 28
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / span) * (h - 4) - 2
      return `${x},${y}`
    })
    .join(' ')
  const up = values[values.length - 1] >= values[0]
  return (
    <svg
      className={`treino-progress-spark${up ? ' is-up' : ' is-down'}`}
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  )
}

export function ProgressionPanel({ items, history = [] }: ProgressionPanelProps) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [sort, setSort] = useState<SortKey>('delta')
  const [open, setOpen] = useState<string | null>(null)

  const musclesInData = useMemo(() => {
    const set = new Set<MuscleGroup>()
    for (const item of items) set.add(item.muscle)
    return (Object.keys(MUSCLE_LABELS) as MuscleGroup[]).filter((m) =>
      set.has(m),
    )
  }, [items])

  const overview = useMemo(() => {
    const rising = items.filter((i) => i.delta > 0).length
    const falling = items.filter((i) => i.delta < 0).length
    const withPr = items.filter(
      (i) => i.lastWeight > 0 && i.lastWeight >= i.bestWeight && i.delta > 0,
    ).length
    const totalSessions = new Set(
      history.filter((w) => w.completedAt).map((w) => w.dateKey),
    ).size
    const last30Keys = (() => {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 30)
      const key = cutoff.toISOString().slice(0, 10)
      return key
    })()
    let volume30 = 0
    for (const item of items) {
      for (const s of item.sessions) {
        if (s.dateKey >= last30Keys) volume30 += s.volume
      }
    }
    const topGainer = [...items]
      .filter((i) => i.delta > 0)
      .sort((a, b) => b.delta - a.delta)[0]
    return {
      rising,
      falling,
      withPr,
      totalSessions,
      volume30: Math.round(volume30),
      tracked: items.length,
      topGainer,
    }
  }, [items, history])

  const filtered = useMemo(() => {
    const list =
      filter === 'all' ? items : items.filter((i) => i.muscle === filter)
    const sorted = [...list]
    sorted.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'pt')
      if (sort === 'sessions') return b.sessions.length - a.sessions.length
      if (sort === 'weight') return b.lastWeight - a.lastWeight
      // delta: ganhos primeiro
      if (b.delta !== a.delta) return b.delta - a.delta
      return a.name.localeCompare(b.name, 'pt')
    })
    return sorted
  }, [items, filter, sort])

  if (items.length === 0) {
    return (
      <div className="surface treino-progress-empty">
        <Trophy size={28} aria-hidden />
        <strong>Ainda sem progressão</strong>
        <p>
          Conclui treinos com cargas registadas para ver evolução por
          exercício, recordes e tendências.
        </p>
      </div>
    )
  }

  return (
    <div className="treino-progress">
      <div className="treino-progress-hero">
        <div className="treino-progress-hero__stat">
          <span>
            <Activity size={14} aria-hidden /> Exercícios
          </span>
          <strong>{overview.tracked}</strong>
          <em>com histórico</em>
        </div>
        <div className="treino-progress-hero__stat is-up">
          <span>
            <TrendingUp size={14} aria-hidden /> A subir
          </span>
          <strong>{overview.rising}</strong>
          <em>
            {overview.falling > 0 ? `${overview.falling} a descer` : 'vs última'}
          </em>
        </div>
        <div className="treino-progress-hero__stat">
          <span>
            <Flame size={14} aria-hidden /> Volume 30d
          </span>
          <strong>{overview.volume30.toLocaleString('pt-BR')}</strong>
          <em>kg acumulados</em>
        </div>
        <div className="treino-progress-hero__stat is-gold">
          <span>
            <Trophy size={14} aria-hidden /> PRs recentes
          </span>
          <strong>{overview.withPr}</strong>
          <em>{overview.totalSessions} dias com treino</em>
        </div>
      </div>

      {overview.topGainer && (
        <div className="surface treino-progress-highlight">
          <Sparkles size={18} aria-hidden />
          <div>
            <p className="page-kicker">Destaque</p>
            <strong>{overview.topGainer.name}</strong>
            <span>
              +{overview.topGainer.delta} kg na última sessão ·{' '}
              {MUSCLE_LABELS[overview.topGainer.muscle]}
            </span>
          </div>
        </div>
      )}

      <div className="treino-progress-filters" role="tablist" aria-label="Grupo muscular">
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'all'}
          className={`treino-progress-chip${filter === 'all' ? ' is-active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Todos
          <em>{items.length}</em>
        </button>
        {musclesInData.map((m) => {
          const count = items.filter((i) => i.muscle === m).length
          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={filter === m}
              className={`treino-progress-chip${filter === m ? ' is-active' : ''}`}
              onClick={() => setFilter(m)}
            >
              {MUSCLE_LABELS[m]}
              <em>{count}</em>
            </button>
          )
        })}
      </div>

      <div className="treino-progress-sort" role="group" aria-label="Ordenar">
        {(
          [
            ['delta', 'Evolução'],
            ['weight', 'Carga'],
            ['sessions', 'Sessões'],
            ['name', 'Nome'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`treino-progress-sort__btn${sort === key ? ' is-active' : ''}`}
            onClick={() => setSort(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="treino-progress-count">
        {filtered.length} exercício{filtered.length === 1 ? '' : 's'}
        {filter !== 'all' ? ` · ${MUSCLE_LABELS[filter]}` : ''}
      </p>

      {filtered.length === 0 ? (
        <div className="surface treino-progress-empty">
          <p>Nenhum exercício neste grupo ainda.</p>
        </div>
      ) : (
        filtered.map((item) => {
          const isOpen = open === item.key
          const TrendIcon =
            item.delta > 0 ? TrendingUp : item.delta < 0 ? TrendingDown : Minus
          const deltaLabel =
            item.delta === 0
              ? 'estável'
              : `${item.delta > 0 ? '+' : ''}${item.delta} kg`
          const sparkValues = [...item.sessions]
            .slice(0, 8)
            .reverse()
            .map((s) => s.maxWeight)
          const rm = estimate1RM(item)
          const volPct = volumeDeltaPct(item)
          const streak = improveStreak(item)
          const isPr =
            item.lastWeight > 0 &&
            item.lastWeight >= item.bestWeight &&
            item.delta > 0

          return (
            <div
              key={item.key}
              className={`surface treino-progress-row${isOpen ? ' is-open' : ''}${isPr ? ' is-pr' : ''}`}
            >
              <button
                type="button"
                className="treino-progress-row__head"
                onClick={() => setOpen(isOpen ? null : item.key)}
                aria-expanded={isOpen}
              >
                <span className="treino-progress-row__info">
                  <strong>
                    {item.name}
                    {isPr ? <span className="treino-progress-pr-tag">PR</span> : null}
                  </strong>
                  <span>
                    {MUSCLE_LABELS[item.muscle]} · {item.sessions.length}{' '}
                    sessão{item.sessions.length === 1 ? '' : 'ões'}
                  </span>
                </span>
                <Sparkline values={sparkValues} />
                <span className="treino-progress-row__stats">
                  <em>{formatKg(item.lastWeight)}</em>
                  <span
                    className={`treino-progress-delta${
                      item.delta > 0
                        ? ' is-up'
                        : item.delta < 0
                          ? ' is-down'
                          : ''
                    }`}
                  >
                    <TrendIcon size={13} />
                    {deltaLabel}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  className={`treino-ex__chevron${isOpen ? ' is-open' : ''}`}
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="treino-progress-row__body"
                  >
                    <div className="treino-progress-meta">
                      <div>
                        <span>Recorde</span>
                        <strong>{formatKg(item.bestWeight)}</strong>
                      </div>
                      <div>
                        <span>1RM est.</span>
                        <strong>{rm ? `${rm} kg` : '—'}</strong>
                      </div>
                      <div>
                        <span>Volume</span>
                        <strong>
                          {volPct === null
                            ? '—'
                            : `${volPct > 0 ? '+' : ''}${volPct}%`}
                        </strong>
                      </div>
                      <div>
                        <span>Sequência ↑</span>
                        <strong>
                          {streak > 0 ? `${streak}×` : '—'}
                        </strong>
                      </div>
                    </div>

                    <p className="treino-progress-best">
                      Última sessão:{' '}
                      <strong>
                        {item.sessions[0]?.bestSet ?? '—'}
                      </strong>
                      {item.sessions[0]
                        ? ` · ${item.sessions[0].setsDone} séries · ${Math.round(item.sessions[0].volume)} kg vol.`
                        : ''}
                    </p>

                    <ul className="treino-progress-sessions">
                      {item.sessions.slice(0, 10).map((s, i) => {
                        const prev = item.sessions[i + 1]
                        const wDelta = prev
                          ? s.maxWeight - prev.maxWeight
                          : 0
                        return (
                          <li key={`${s.dateKey}-${i}`}>
                            <span>
                              <strong>
                                {s.dateKey.slice(8)}/{s.dateKey.slice(5, 7)}
                              </strong>
                              <em>{s.workoutName}</em>
                            </span>
                            <span className="treino-progress-sessions__right">
                              {s.bestSet}
                              {wDelta !== 0 && (
                                <em
                                  className={
                                    wDelta > 0
                                      ? 'is-up'
                                      : wDelta < 0
                                        ? 'is-down'
                                        : ''
                                  }
                                >
                                  {wDelta > 0 ? '+' : ''}
                                  {wDelta} kg
                                </em>
                              )}
                              <em>
                                {s.setsDone} sér. · {Math.round(s.volume)} kg
                              </em>
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })
      )}
    </div>
  )
}
