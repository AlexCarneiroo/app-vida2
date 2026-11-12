import { AnimatePresence, motion } from 'framer-motion'
import {
  AlarmClock,
  CalendarDays,
  ChartColumn,
  Check,
  Coffee,
  Moon,
  Plus,
  Smartphone,
  Sparkles,
  Target,
  Timer,
  Trash2,
  Wind,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  availabilityForDay,
  expandEvents,
  sortAgendaItems,
} from '../../lib/agendaEngine'
import { formatDateBR, shiftDateKey } from '../../lib/date'
import {
  buildRichSleepInsights,
  challengeProgress,
  monthSleepCells,
  sleepRangeStats,
  suggestSleepFromAgenda,
  type SleepRangeStats,
} from '../../lib/sleepEngine'
import { useAgenda } from '../../hooks/useAgenda'
import type {
  NapEntry,
  SleepChallenge,
  SleepChallengeKind,
  SleepEntry,
  SleepHabitFlags,
  SleepQuality,
  SleepRoutineItem,
} from '../../types/saude'
import { Button } from '../ui/Button'
import { InsightList, StatTile } from './SaudeShared'

type SleepSubTab =
  | 'painel'
  | 'historico'
  | 'stats'
  | 'metas'
  | 'rotina'
  | 'cochilos'

const SUBS: { id: SleepSubTab; label: string; icon: typeof Moon }[] = [
  { id: 'painel', label: 'Painel', icon: Moon },
  { id: 'historico', label: 'Histórico', icon: CalendarDays },
  { id: 'stats', label: 'Stats', icon: ChartColumn },
  { id: 'metas', label: 'Metas', icon: Target },
  { id: 'rotina', label: 'Rotina', icon: Wind },
  { id: 'cochilos', label: 'Cochilos', icon: Timer },
]

const DAY_LABEL = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const HABIT_META: {
  key: keyof SleepHabitFlags
  label: string
  icon: typeof Coffee
}[] = [
  { key: 'phoneBeforeBed', label: 'Telemóvel', icon: Smartphone },
  { key: 'caffeineLate', label: 'Cafeína', icon: Coffee },
  { key: 'exerciseLate', label: 'Treino tarde', icon: Timer },
  { key: 'alcohol', label: 'Álcool', icon: Sparkles },
  { key: 'heavyMeal', label: 'Refeição pesada', icon: AlarmClock },
]

export function SleepModule({
  today,
  sleep,
  tonightSleep,
  sleepWeek,
  sleepDebt,
  sleepGoalHours,
  sleepGoalBedTime,
  sleepGoalWakeTime,
  reminderEnabled,
  reminderTime,
  windDownEnabled,
  windDownMinutes,
  weeklySleepTarget,
  sleepWeekDays,
  sleepRoutine,
  sleepRoutineDone,
  sleepChallenge,
  naps,
  napsToday,
  onRegister,
  onOpenGoals,
  onRemoveSleep,
  onAddNap,
  onRemoveNap,
  onToggleRoutine,
  onBeginChallenge,
  onClearChallenge,
  onSetGoals,
}: {
  today: string
  sleep: SleepEntry[]
  tonightSleep: SleepEntry | null
  sleepWeek: { dateKey: string; hours: number; quality?: SleepQuality }[]
  sleepDebt: number
  sleepGoalHours: number
  sleepGoalBedTime: string
  sleepGoalWakeTime: string
  reminderEnabled: boolean
  reminderTime: string
  windDownEnabled: boolean
  windDownMinutes: number
  weeklySleepTarget: number
  sleepWeekDays: number
  sleepRoutine: SleepRoutineItem[]
  sleepRoutineDone: Record<string, string[]>
  sleepChallenge: SleepChallenge | null
  naps: NapEntry[]
  napsToday: NapEntry[]
  onRegister: () => void
  onOpenGoals: () => void
  onRemoveSleep: (id: string) => void
  onAddNap: (input: { startTime: string; endTime: string; note?: string }) => void
  onRemoveNap: (id: string) => void
  onToggleRoutine: (id: string) => void
  onBeginChallenge: (kind: SleepChallengeKind) => void
  onClearChallenge: () => void
  onSetGoals: (patch: {
    sleepGoalHours?: number
    sleepGoalBedTime?: string
    sleepGoalWakeTime?: string
    windDownEnabled?: boolean
    windDownMinutes?: number
    sleepReminderEnabled?: boolean
    sleepReminderTime?: string
  }) => void
}) {
  const [sub, setSub] = useState<SleepSubTab>('painel')
  const [monthAnchor, setMonthAnchor] = useState(() => new Date())
  const [histMode, setHistMode] = useState<'semana' | 'mes'>('semana')
  const [napStart, setNapStart] = useState('14:00')
  const [napEnd, setNapEnd] = useState('14:25')
  const [goalHoursDraft, setGoalHoursDraft] = useState(String(sleepGoalHours))
  const [goalBedDraft, setGoalBedDraft] = useState(sleepGoalBedTime)
  const [goalWakeDraft, setGoalWakeDraft] = useState(sleepGoalWakeTime)

  const agenda = useAgenda()

  // Integra metas de sono da Saúde na faixa de sono da Agenda (só se ainda for o default).
  useEffect(() => {
    const isDefaultAgenda =
      agenda.sleepStart === '23:00' && agenda.sleepEnd === '07:00'
    if (!isDefaultAgenda) return
    if (
      sleepGoalBedTime === agenda.sleepStart &&
      sleepGoalWakeTime === agenda.sleepEnd
    ) {
      return
    }
    if (sleepGoalBedTime === '22:30' && sleepGoalWakeTime === '06:30') return
    agenda.setSleepWindow(sleepGoalBedTime, sleepGoalWakeTime)
  }, [
    agenda.sleepStart,
    agenda.sleepEnd,
    agenda.setSleepWindow,
    sleepGoalBedTime,
    sleepGoalWakeTime,
  ])

  const agendaSuggestion = useMemo(() => {
    const tomorrow = shiftDateKey(today, 1)
    const avail = availabilityForDay(agenda.state, tomorrow)
    const items = expandEvents(
      agenda.state.events ?? [],
      tomorrow,
      tomorrow,
      agenda.state.categories ?? [],
    )
      .filter((i) => !i.allDay && i.startTime)
      .sort(sortAgendaItems)
    const first = items[0]?.startTime ?? null
    return suggestSleepFromAgenda({
      goalHours: sleepGoalHours,
      workStart: avail.startTime,
      firstEventStart: first,
      windDownMinutes,
    })
  }, [agenda.state, today, sleepGoalHours, windDownMinutes])

  const stats7 = useMemo(
    () => sleepRangeStats(sleep, today, 7, sleepGoalHours),
    [sleep, today, sleepGoalHours],
  )
  const stats30 = useMemo(
    () => sleepRangeStats(sleep, today, 30, sleepGoalHours),
    [sleep, today, sleepGoalHours],
  )
  const insights = useMemo(
    () =>
      buildRichSleepInsights({
        stats7,
        stats30,
        sleepDebt,
        tonight: tonightSleep,
        napsTodayMin: napsToday.reduce((a, n) => a + n.minutes, 0),
        agendaHint: agendaSuggestion?.reason ?? null,
      }),
    [stats7, stats30, sleepDebt, tonightSleep, napsToday, agendaSuggestion],
  )
  const challenge = useMemo(
    () => challengeProgress(sleep, sleepChallenge, today, sleepGoalHours),
    [sleep, sleepChallenge, today, sleepGoalHours],
  )
  const monthCells = useMemo(
    () => monthSleepCells(sleep, monthAnchor),
    [sleep, monthAnchor],
  )
  const routineEnabled = sleepRoutine
    .filter((r) => r.enabled)
    .sort((a, b) => a.order - b.order)
  const doneToday = new Set(sleepRoutineDone[today] ?? [])
  const routinePct = routineEnabled.length
    ? Math.round(
        (routineEnabled.filter((r) => doneToday.has(r.id)).length /
          routineEnabled.length) *
          100,
      )
    : 0

  const last = tonightSleep
  const goalHit =
    last != null &&
    last.hours >= sleepGoalHours - 0.5 &&
    last.hours <= sleepGoalHours + 1.5

  return (
    <div className="sleep-module">
      <section className="surface sleep-hero">
        <div className="sleep-hero__main">
          <p className="page-kicker">Módulo sono & recuperação</p>
          <strong>
            {last ? `${last.hours}h na última noite` : 'Sem registo desta noite'}
          </strong>
          <span>
            {last?.bedTime && last?.wakeTime
              ? `${last.bedTime} → ${last.wakeTime}`
              : `Meta ${sleepGoalHours}h · deitar ${sleepGoalBedTime}`}
            {last?.quality ? ` · qualidade ${last.quality}/5` : ''}
            {last?.readiness ? ` · disposição ${last.readiness}/5` : ''}
          </span>
          <div className="sleep-hero__pills">
            <em className={goalHit ? 'is-ok' : undefined}>
              Meta {sleepGoalHours}h {goalHit ? 'atingida' : 'por cumprir'}
            </em>
            {sleepDebt > 0 ? <em className="is-warn">Débito ~{sleepDebt}h</em> : null}
            {reminderEnabled ? <em>Lembrete {reminderTime}</em> : null}
          </div>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={onRegister}>
          Registar noite
        </Button>
      </section>

      <nav
        className="config-section-tabs sleep-section-tabs"
        role="tablist"
        aria-label="Secções do sono"
      >
        {SUBS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={sub === id}
            className={sub === id ? 'is-active' : undefined}
            onClick={() => setSub(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        <motion.div
          key={sub}
          className="sleep-subpanel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {sub === 'painel' && (
            <Painel
              last={last}
              sleepGoalHours={sleepGoalHours}
              sleepWeek={sleepWeek}
              stats7={stats7}
              insights={insights}
              agendaSuggestion={agendaSuggestion}
              challenge={challenge}
              sleepChallenge={sleepChallenge}
              weeklySleepTarget={weeklySleepTarget}
              sleepWeekDays={sleepWeekDays}
              onRegister={onRegister}
              onOpenGoals={onOpenGoals}
              onGoMetas={() => setSub('metas')}
            />
          )}

          {sub === 'historico' && (
            <Historico
              histMode={histMode}
              setHistMode={setHistMode}
              sleepWeek={sleepWeek}
              monthCells={monthCells}
              monthAnchor={monthAnchor}
              setMonthAnchor={setMonthAnchor}
              sleep={sleep}
              onRegister={onRegister}
              onRemoveSleep={onRemoveSleep}
            />
          )}

          {sub === 'stats' && (
            <Stats stats7={stats7} stats30={stats30} />
          )}

          {sub === 'metas' && (
            <Metas
              goalHoursDraft={goalHoursDraft}
              setGoalHoursDraft={setGoalHoursDraft}
              goalBedDraft={goalBedDraft}
              setGoalBedDraft={setGoalBedDraft}
              goalWakeDraft={goalWakeDraft}
              setGoalWakeDraft={setGoalWakeDraft}
              reminderEnabled={reminderEnabled}
              reminderTime={reminderTime}
              windDownEnabled={windDownEnabled}
              windDownMinutes={windDownMinutes}
              weeklySleepTarget={weeklySleepTarget}
              sleepWeekDays={sleepWeekDays}
              challenge={challenge}
              sleepChallenge={sleepChallenge}
              streak={stats30.streak}
              onSetGoals={onSetGoals}
              onBeginChallenge={onBeginChallenge}
              onClearChallenge={onClearChallenge}
              onOpenWeeklyGoals={onOpenGoals}
            />
          )}

          {sub === 'rotina' && (
            <Rotina
              items={routineEnabled}
              doneToday={doneToday}
              routinePct={routinePct}
              windDownEnabled={windDownEnabled}
              windDownMinutes={windDownMinutes}
              sleepGoalBedTime={sleepGoalBedTime}
              onToggleRoutine={onToggleRoutine}
              onOpenMetas={() => setSub('metas')}
            />
          )}

          {sub === 'cochilos' && (
            <Cochilos
              naps={naps}
              napsToday={napsToday}
              napStart={napStart}
              napEnd={napEnd}
              setNapStart={setNapStart}
              setNapEnd={setNapEnd}
              onAddNap={onAddNap}
              onRemoveNap={onRemoveNap}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Painel({
  last,
  sleepGoalHours,
  sleepWeek,
  stats7,
  insights,
  agendaSuggestion,
  challenge,
  sleepChallenge,
  weeklySleepTarget,
  sleepWeekDays,
  onRegister,
  onOpenGoals,
  onGoMetas,
}: {
  last: SleepEntry | null
  sleepGoalHours: number
  sleepWeek: { dateKey: string; hours: number; quality?: SleepQuality }[]
  stats7: SleepRangeStats
  insights: ReturnType<typeof buildRichSleepInsights>
  agendaSuggestion: ReturnType<typeof suggestSleepFromAgenda>
  challenge: ReturnType<typeof challengeProgress>
  sleepChallenge: SleepChallenge | null
  weeklySleepTarget: number
  sleepWeekDays: number
  onRegister: () => void
  onOpenGoals: () => void
  onGoMetas: () => void
}) {
  return (
    <>
      <div className="saude-stat-grid">
        <StatTile
          label="Última noite"
          value={last ? `${last.hours}h` : '—'}
          hint={
            last?.quality
              ? `Qualidade ${last.quality}/5`
              : `Meta ${sleepGoalHours}h`
          }
        />
        <StatTile
          label="Disposição"
          value={last?.readiness != null ? `${last.readiness}/5` : '—'}
          hint="ao acordar"
        />
        <StatTile
          label="Latência"
          value={
            last?.latencyMin != null ? `${last.latencyMin} min` : '—'
          }
          hint="até adormecer"
        />
        <StatTile
          label="Despertares"
          value={last?.awakenings != null ? String(last.awakenings) : '—'}
          hint="durante a noite"
        />
      </div>

      <section className="surface saude-sleep-week">
        <div className="saude-trend__head">
          <strong>Semana</strong>
          <span>
            {stats7.goalHitDays}/{stats7.logged || 0} no alvo
          </span>
        </div>
        <div className="saude-sleep-bars is-rich">
          {sleepWeek.map((d) => {
            const dow = new Date(`${d.dateKey}T12:00:00`).getDay()
            const ideal =
              d.hours >= sleepGoalHours - 0.5 &&
              d.hours <= sleepGoalHours + 1.5
            return (
              <div
                key={d.dateKey}
                className={`saude-sleep-bar${d.hours > 0 ? ' has-data' : ''}${ideal ? ' is-ideal' : ''}`}
              >
                <i
                  style={{
                    height: `${Math.min(100, (d.hours / Math.max(9, sleepGoalHours + 1)) * 100)}%`,
                  }}
                />
                <em>{DAY_LABEL[dow]}</em>
                <small>{d.hours > 0 ? d.hours : '—'}</small>
              </div>
            )
          })}
        </div>
      </section>

      {last?.habits && (
        <section className="surface sleep-habits-summary">
          <strong>Diário da noite</strong>
          <div className="sleep-habit-chips">
            {HABIT_META.map(({ key, label, icon: Icon }) =>
              last.habits?.[key] ? (
                <span key={key} className="sleep-habit-chip is-on">
                  <Icon size={12} />
                  {label}
                </span>
              ) : null,
            )}
            {!HABIT_META.some((h) => last.habits?.[h.key]) && (
              <em>Sem hábitos de risco marcados</em>
            )}
          </div>
        </section>
      )}

      <section className="surface saude-challenge">
        <div className="saude-challenge__head">
          <div>
            <p className="page-kicker">
              {sleepChallenge?.active
                ? `Desafio ${sleepChallenge.kind} dias`
                : 'Meta semanal'}
            </p>
            <strong>
              {sleepChallenge?.active
                ? `${challenge.current}/${challenge.target} noites`
                : `${sleepWeekDays}/${weeklySleepTarget} noites 7–9h`}
            </strong>
          </div>
          <button type="button" className="btn btn--ghost" onClick={onGoMetas}>
            Gerir
          </button>
        </div>
        <div className="saude-challenge__bar" aria-hidden>
          <i
            style={{
              width: `${
                sleepChallenge?.active
                  ? challenge.pct
                  : Math.min(
                      100,
                      Math.round(
                        (sleepWeekDays / Math.max(1, weeklySleepTarget)) * 100,
                      ),
                    )
              }%`,
            }}
          />
        </div>
      </section>

      {agendaSuggestion && (
        <section className="surface sleep-agenda-hint">
          <CalendarDays size={16} />
          <div>
            <strong>Sugestão via Agenda</strong>
            <span>{agendaSuggestion.reason}</span>
          </div>
        </section>
      )}

      <section className="surface saude-doc">
        <div className="saude-doc__head">
          <span className="saude-doc__avatar" aria-hidden>
            <Sparkles size={18} />
          </span>
          <div>
            <p className="page-kicker">Insights</p>
            <strong>Padrões reais dos teus registos</strong>
            <span>Sem métricas inventadas de wearables</span>
          </div>
          <button type="button" className="btn btn--ghost" onClick={onRegister}>
            Registar
          </button>
        </div>
        <InsightList items={insights} />
      </section>

      <div className="sleep-quick-row">
        <Button variant="ghost" onClick={onOpenGoals}>
          Metas semanais saúde
        </Button>
        <Button variant="primary" icon={<Plus size={16} />} onClick={onRegister}>
          Nova noite
        </Button>
      </div>
    </>
  )
}

function Historico({
  histMode,
  setHistMode,
  sleepWeek,
  monthCells,
  monthAnchor,
  setMonthAnchor,
  sleep,
  onRegister,
  onRemoveSleep,
}: {
  histMode: 'semana' | 'mes'
  setHistMode: (m: 'semana' | 'mes') => void
  sleepWeek: { dateKey: string; hours: number; quality?: SleepQuality }[]
  monthCells: ReturnType<typeof monthSleepCells>
  monthAnchor: Date
  setMonthAnchor: (d: Date) => void
  sleep: SleepEntry[]
  onRegister: () => void
  onRemoveSleep: (id: string) => void
}) {
  const recent = [...sleep]
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    .slice(0, 14)

  return (
    <>
      <div className="sleep-seg">
        <button
          type="button"
          className={histMode === 'semana' ? 'is-on' : undefined}
          onClick={() => setHistMode('semana')}
        >
          Semana
        </button>
        <button
          type="button"
          className={histMode === 'mes' ? 'is-on' : undefined}
          onClick={() => setHistMode('mes')}
        >
          Mês
        </button>
      </div>

      {histMode === 'semana' ? (
        <section className="surface saude-sleep-week">
          <div className="saude-sleep-bars is-rich">
            {sleepWeek.map((d) => {
              const dow = new Date(`${d.dateKey}T12:00:00`).getDay()
              return (
                <div
                  key={d.dateKey}
                  className={`saude-sleep-bar${d.hours > 0 ? ' has-data' : ''}`}
                >
                  <i
                    style={{
                      height: `${Math.min(100, (d.hours / 9) * 100)}%`,
                    }}
                  />
                  <em>{DAY_LABEL[dow]}</em>
                  <small>{d.hours > 0 ? d.hours : '—'}</small>
                </div>
              )
            })}
          </div>
        </section>
      ) : (
        <section className="surface sleep-month">
          <div className="saude-trend__head">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() =>
                setMonthAnchor(
                  new Date(
                    monthAnchor.getFullYear(),
                    monthAnchor.getMonth() - 1,
                    1,
                  ),
                )
              }
            >
              ‹
            </button>
            <strong>
              {monthAnchor.toLocaleDateString('pt-BR', {
                month: 'long',
                year: 'numeric',
              })}
            </strong>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() =>
                setMonthAnchor(
                  new Date(
                    monthAnchor.getFullYear(),
                    monthAnchor.getMonth() + 1,
                    1,
                  ),
                )
              }
            >
              ›
            </button>
          </div>
          <div className="sleep-month__head">
            {DAY_LABEL.map((d, i) => (
              <span key={`${d}-${i}`}>{d}</span>
            ))}
          </div>
          <div className="sleep-month__grid">
            {monthCells.map((c) => (
              <div
                key={c.dateKey}
                className={`sleep-month__cell${!c.inMonth ? ' is-out' : ''}${c.entry ? ' has-data' : ''}`}
                title={
                  c.entry
                    ? `${c.entry.hours}h · Q${c.entry.quality}`
                    : undefined
                }
              >
                <em>{Number(c.dateKey.slice(8))}</em>
                {c.entry ? <i /> : null}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="surface saude-history">
        <div className="saude-trend__head">
          <strong>Registos</strong>
          <button type="button" className="btn btn--ghost" onClick={onRegister}>
            Novo
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="saude-empty">Ainda sem noites guardadas.</p>
        ) : (
          <ul className="saude-history-list">
            {recent.map((e) => (
              <li key={e.id} className="sleep-history-row">
                <div>
                  <strong>{formatDateBR(e.dateKey)}</strong>
                  <span>
                    {e.hours}h
                    {e.bedTime && e.wakeTime
                      ? ` · ${e.bedTime}–${e.wakeTime}`
                      : ''}
                    {` · Q${e.quality}`}
                    {e.readiness ? ` · D${e.readiness}` : ''}
                    {e.latencyMin != null ? ` · latência ${e.latencyMin}m` : ''}
                    {e.awakenings != null ? ` · ${e.awakenings} desp.` : ''}
                  </span>
                  {e.note ? <em>{e.note}</em> : null}
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => onRemoveSleep(e.id)}
                  aria-label="Remover"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function Stats({
  stats7,
  stats30,
}: {
  stats7: SleepRangeStats
  stats30: SleepRangeStats
}) {
  return (
    <>
      <div className="saude-stat-grid">
        <StatTile
          label="Média 7d"
          value={stats7.avgHours != null ? `${stats7.avgHours}h` : '—'}
          hint={`${stats7.logged} noites`}
        />
        <StatTile
          label="Média 30d"
          value={stats30.avgHours != null ? `${stats30.avgHours}h` : '—'}
          hint={`${stats30.logged} noites`}
        />
        <StatTile
          label="Qualidade"
          value={
            stats7.avgQuality != null ? `${stats7.avgQuality}/5` : '—'
          }
          hint="média 7d"
        />
        <StatTile
          label="Disposição"
          value={
            stats7.avgReadiness != null ? `${stats7.avgReadiness}/5` : '—'
          }
          hint="média 7d"
        />
      </div>

      <section className="surface sleep-stat-card">
        <strong>Regularidade de horários</strong>
        <p>
          Deitar varia ~{stats7.bedRegularityMin ?? '—'} min · Acordar varia ~
          {stats7.wakeRegularityMin ?? '—'} min (desvio na semana).
        </p>
      </section>

      <section className="surface sleep-stat-card">
        <strong>Cumprimento da meta</strong>
        <p>
          7 dias: {stats7.goalHitDays}/{stats7.logged || 0} · 30 dias:{' '}
          {stats30.goalHitDays}/{stats30.logged || 0} (meta {stats7.goalHours}
          h ± margem).
        </p>
        <div className="saude-challenge__bar" aria-hidden>
          <i
            style={{
              width: `${
                stats7.logged
                  ? Math.round((stats7.goalHitDays / stats7.logged) * 100)
                  : 0
              }%`,
            }}
          />
        </div>
      </section>

      <section className="surface sleep-stat-card">
        <strong>Hábitos associados (noites com diário)</strong>
        <div className="sleep-habit-rates">
          {HABIT_META.map(({ key, label }) => (
            <div key={key}>
              <span>{label}</span>
              <strong>{stats30.habitRates[key]}%</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="surface sleep-stat-card">
        <strong>Adormecer & despertares</strong>
        <p>
          Latência média {stats7.avgLatency ?? '—'} min · Despertares médios{' '}
          {stats7.avgAwakenings ?? '—'}
        </p>
      </section>
    </>
  )
}

function Metas({
  goalHoursDraft,
  setGoalHoursDraft,
  goalBedDraft,
  setGoalBedDraft,
  goalWakeDraft,
  setGoalWakeDraft,
  reminderEnabled,
  reminderTime,
  windDownEnabled,
  windDownMinutes,
  weeklySleepTarget,
  sleepWeekDays,
  challenge,
  sleepChallenge,
  streak,
  onSetGoals,
  onBeginChallenge,
  onClearChallenge,
  onOpenWeeklyGoals,
}: {
  goalHoursDraft: string
  setGoalHoursDraft: (v: string) => void
  goalBedDraft: string
  setGoalBedDraft: (v: string) => void
  goalWakeDraft: string
  setGoalWakeDraft: (v: string) => void
  reminderEnabled: boolean
  reminderTime: string
  windDownEnabled: boolean
  windDownMinutes: number
  weeklySleepTarget: number
  sleepWeekDays: number
  challenge: ReturnType<typeof challengeProgress>
  sleepChallenge: SleepChallenge | null
  streak: number
  onSetGoals: (patch: {
    sleepGoalHours?: number
    sleepGoalBedTime?: string
    sleepGoalWakeTime?: string
    windDownEnabled?: boolean
    windDownMinutes?: number
    sleepReminderEnabled?: boolean
    sleepReminderTime?: string
  }) => void
  onBeginChallenge: (kind: SleepChallengeKind) => void
  onClearChallenge: () => void
  onOpenWeeklyGoals: () => void
}) {
  return (
    <>
      <section className="surface saude-panel sleep-goals-form">
        <strong>Objetivos pessoais</strong>
        <div className="saude-exam-grid">
          <label className="plan-field">
            <span>Meta diária (h)</span>
            <input
              type="number"
              min={5}
              max={12}
              step={0.5}
              value={goalHoursDraft}
              onChange={(e) => setGoalHoursDraft(e.target.value)}
            />
          </label>
          <label className="plan-field">
            <span>Preparação (min)</span>
            <input
              type="number"
              min={10}
              max={180}
              value={windDownMinutes}
              onChange={(e) =>
                onSetGoals({ windDownMinutes: Number(e.target.value) || 45 })
              }
            />
          </label>
          <label className="plan-field">
            <span>Deitar alvo</span>
            <input
              type="time"
              value={goalBedDraft}
              onChange={(e) => setGoalBedDraft(e.target.value)}
            />
          </label>
          <label className="plan-field">
            <span>Acordar alvo</span>
            <input
              type="time"
              value={goalWakeDraft}
              onChange={(e) => setGoalWakeDraft(e.target.value)}
            />
          </label>
        </div>
        <div className="sleep-switch-row">
          <span>Lembrete de sono</span>
          <button
            type="button"
            className={`config-switch${reminderEnabled ? ' is-on' : ''}`}
            role="switch"
            aria-checked={reminderEnabled}
            onClick={() =>
              onSetGoals({ sleepReminderEnabled: !reminderEnabled })
            }
          >
            <span className="config-switch__knob" />
          </button>
          <input
            type="time"
            value={reminderTime}
            onChange={(e) =>
              onSetGoals({ sleepReminderTime: e.target.value })
            }
          />
        </div>
        <div className="sleep-switch-row">
          <span>Lembrete de preparação</span>
          <button
            type="button"
            className={`config-switch${windDownEnabled ? ' is-on' : ''}`}
            role="switch"
            aria-checked={windDownEnabled}
            onClick={() => onSetGoals({ windDownEnabled: !windDownEnabled })}
          >
            <span className="config-switch__knob" />
          </button>
        </div>
        <Button
          variant="primary"
          onClick={() =>
            onSetGoals({
              sleepGoalHours: Number(goalHoursDraft) || 8,
              sleepGoalBedTime: goalBedDraft,
              sleepGoalWakeTime: goalWakeDraft,
            })
          }
        >
          Guardar objetivos
        </Button>
      </section>

      <section className="surface saude-challenge">
        <div className="saude-challenge__head">
          <div>
            <p className="page-kicker">Sequência atual</p>
            <strong>{streak} noites na meta</strong>
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onOpenWeeklyGoals}
          >
            Meta semanal ({sleepWeekDays}/{weeklySleepTarget})
          </button>
        </div>
      </section>

      <section className="surface sleep-challenges">
        <strong>Desafios</strong>
        <p className="saude-empty" style={{ marginTop: '0.35rem' }}>
          Cumpre a meta diária em noites consecutivas a partir de hoje.
        </p>
        {sleepChallenge?.active ? (
          <div className="sleep-challenge-active">
            <div>
              <strong>Desafio {sleepChallenge.kind} dias</strong>
              <span>
                {challenge.current}/{challenge.target} · desde{' '}
                {sleepChallenge.startDateKey}
              </span>
            </div>
            <div className="saude-challenge__bar">
              <i style={{ width: `${challenge.pct}%` }} />
            </div>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClearChallenge}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="sleep-challenge-picks">
            {([7, 14, 30] as SleepChallengeKind[]).map((k) => (
              <button
                key={k}
                type="button"
                className="surface sleep-challenge-pick"
                onClick={() => onBeginChallenge(k)}
              >
                <Target size={16} />
                {k} dias
              </button>
            ))}
          </div>
        )}
        {sleepChallenge && !sleepChallenge.active && sleepChallenge.completedDateKey ? (
          <p className="saude-checkin-note">
            Último desafio concluído em {sleepChallenge.completedDateKey}.
          </p>
        ) : null}
      </section>
    </>
  )
}

function Rotina({
  items,
  doneToday,
  routinePct,
  windDownEnabled,
  windDownMinutes,
  sleepGoalBedTime,
  onToggleRoutine,
  onOpenMetas,
}: {
  items: SleepRoutineItem[]
  doneToday: Set<string>
  routinePct: number
  windDownEnabled: boolean
  windDownMinutes: number
  sleepGoalBedTime: string
  onToggleRoutine: (id: string) => void
  onOpenMetas: () => void
}) {
  const bedMin = sleepGoalBedTime
  return (
    <>
      <section className="surface saude-challenge">
        <div className="saude-challenge__head">
          <div>
            <p className="page-kicker">Rotina noturna</p>
            <strong>{routinePct}% concluída hoje</strong>
          </div>
          <button type="button" className="btn btn--ghost" onClick={onOpenMetas}>
            Horários
          </button>
        </div>
        <div className="saude-challenge__bar">
          <i style={{ width: `${routinePct}%` }} />
        </div>
        <span className="saude-challenge__hint">
          {windDownEnabled
            ? `Preparação sugerida ${windDownMinutes} min antes das ${bedMin}.`
            : 'Lembrete de preparação desligado.'}
        </span>
      </section>

      <section className="surface sleep-routine-list">
        {items.length === 0 ? (
          <p className="saude-empty">Nenhum item ativo na rotina.</p>
        ) : (
          <ul>
            {items.map((item) => {
              const done = doneToday.has(item.id)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`sleep-routine-item${done ? ' is-done' : ''}`}
                    onClick={() => onToggleRoutine(item.id)}
                  >
                    <span className="sleep-routine-check" aria-hidden>
                      {done ? <Check size={14} /> : null}
                    </span>
                    <strong>{item.label}</strong>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}

function Cochilos({
  naps,
  napsToday,
  napStart,
  napEnd,
  setNapStart,
  setNapEnd,
  onAddNap,
  onRemoveNap,
}: {
  naps: NapEntry[]
  napsToday: NapEntry[]
  napStart: string
  napEnd: string
  setNapStart: (v: string) => void
  setNapEnd: (v: string) => void
  onAddNap: (input: { startTime: string; endTime: string }) => void
  onRemoveNap: (id: string) => void
}) {
  const recent = [...naps]
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.startTime.localeCompare(a.startTime))
    .slice(0, 12)
  const todayMin = napsToday.reduce((a, n) => a + n.minutes, 0)

  return (
    <>
      <section className="surface saude-panel">
        <strong>Registar cochilo</strong>
        <div className="saude-exam-grid">
          <label className="plan-field">
            <span>Início</span>
            <input
              type="time"
              value={napStart}
              onChange={(e) => setNapStart(e.target.value)}
            />
          </label>
          <label className="plan-field">
            <span>Fim</span>
            <input
              type="time"
              value={napEnd}
              onChange={(e) => setNapEnd(e.target.value)}
            />
          </label>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => onAddNap({ startTime: napStart, endTime: napEnd })}
        >
          Guardar cochilo
        </Button>
        <p className="saude-imc-preview">
          Hoje: {todayMin} min em {napsToday.length} cochilo
          {napsToday.length === 1 ? '' : 's'}.
        </p>
      </section>

      <section className="surface saude-history">
        <strong>Histórico</strong>
        {recent.length === 0 ? (
          <p className="saude-empty">Ainda sem cochilos registados.</p>
        ) : (
          <ul className="saude-history-list">
            {recent.map((n) => (
              <li key={n.id} className="sleep-history-row">
                <div>
                  <strong>
                    {n.dateKey.slice(8)}/{n.dateKey.slice(5, 7)} · {n.minutes}{' '}
                    min
                  </strong>
                  <span>
                    {n.startTime}–{n.endTime}
                  </span>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => onRemoveNap(n.id)}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
