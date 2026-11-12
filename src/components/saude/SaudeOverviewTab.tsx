import { motion } from 'framer-motion'
import {
  Activity,
  Droplets,
  FlaskConical,
  Moon,
  Scale,
  Stethoscope,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { HealthInsight } from '../../data/saudeDefaults'
import type { LabExam, QuickConsult } from '../../types/saude'
import { ProgressRing } from '../ui/ProgressRing'
import { ActivityHeatmap } from '../ui/ActivityHeatmap'
import { staggerContainer } from '../ui/PageTransition'
import { InsightList, SignalCard, Sparkline } from './SaudeShared'

export function SaudeOverviewTab({
  score,
  signals,
  sleepDebt,
  insights,
  weeklyInsights,
  dueExams,
  lastConsult,
  lastWeightKg,
  projectionWeeks,
  weightSpark,
  moodLog,
  todayCheckIn,
  onOpenSleep,
  onOpenBody,
  onOpenExams,
  onOpenConsult,
  onOpenCheckin,
}: {
  score: number
  signals: {
    waterMl: number
    waterGoalMl: number
    waterOk: boolean
    waterWeekDays: number
    sleepHours: number | null
    sleepOk: boolean
    sleepWeekDays: number
    weeklyGoals: { waterDaysTarget: number; sleepDaysTarget: number }
    kcal: number
    protein: number
    trainedToday: boolean
    imcOk: boolean
  }
  sleepDebt: number
  insights: HealthInsight[]
  weeklyInsights: HealthInsight[]
  dueExams: LabExam[]
  lastConsult: QuickConsult | null
  lastWeightKg: number | null
  projectionWeeks: number | null
  weightSpark: string | null
  moodLog: Record<string, number>
  todayCheckIn: { energy: number; mood: number } | null
  onOpenSleep: () => void
  onOpenBody: () => void
  onOpenExams: () => void
  onOpenConsult: () => void
  onOpenCheckin: () => void
}) {
  return (
    <div className="saude-tab-panel">
      <section className="surface saude-hero">
        <div className="saude-hero__ring">
          <ProgressRing value={score} color="var(--saude)" size={96} />
        </div>
        <div>
          <p className="page-kicker">Painel de vitalidade</p>
          <strong className="saude-hero__score">{score}</strong>
          <p className="saude-hero__hint">
            Água {signals.waterWeekDays}/{signals.weeklyGoals.waterDaysTarget}d
            · Sono {signals.sleepWeekDays}/
            {signals.weeklyGoals.sleepDaysTarget}d
            {sleepDebt > 0 ? ` · débito ~${sleepDebt}h` : ''}
          </p>
        </div>
      </section>

      <section className="surface saude-combo">
        <Droplets size={16} />
        <div>
          <strong>Nutrição do dia</strong>
          <span>
            {signals.kcal} kcal · {Math.round(signals.protein)} g prot ·{' '}
            {signals.waterMl}/{signals.waterGoalMl} ml água
          </span>
        </div>
        <Link to="/nutricao" className="saude-signal__link">
          Abrir
        </Link>
      </section>

      <section className="surface saude-doc">
        <div className="saude-doc__head">
          <span className="saude-doc__avatar" aria-hidden>
            <Stethoscope size={18} />
          </span>
          <div>
            <p className="page-kicker">Insights</p>
            <strong>Resumo inteligente</strong>
            <span>Dia e semana num só olhar</span>
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onOpenConsult}
          >
            Consulta
          </button>
        </div>
        <InsightList items={[...weeklyInsights, ...insights].slice(0, 6)} />
        {lastConsult && (
          <div className="saude-consult-plan">
            <strong>Plano da última consulta</strong>
            <ul>
              {lastConsult.plan.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {dueExams.length > 0 && (
        <button
          type="button"
          className="surface saude-due saude-due--btn"
          onClick={onOpenExams}
        >
          <FlaskConical size={16} />
          <div>
            <strong>Exames a acompanhar</strong>
            <span>
              {dueExams
                .slice(0, 2)
                .map((e) => `${e.name} (${e.nextDueDateKey})`)
                .join(' · ')}
            </span>
          </div>
        </button>
      )}

      <motion.div
        className="saude-signals"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <SignalCard
          icon={<Droplets size={16} />}
          title="Água"
          text={`${signals.waterMl}/${signals.waterGoalMl} ml`}
          ok={signals.waterOk}
          action={<Link to="/nutricao">Abrir</Link>}
        />
        <SignalCard
          icon={<Moon size={16} />}
          title="Sono"
          text={
            signals.sleepHours !== null
              ? `${signals.sleepHours}h`
              : 'Sem registo'
          }
          ok={signals.sleepOk}
          action={
            <button type="button" onClick={onOpenSleep}>
              Registar
            </button>
          }
        />
        <SignalCard
          icon={<Activity size={16} />}
          title="Treino"
          text={signals.trainedToday ? 'Feito' : 'Por fazer'}
          ok={signals.trainedToday}
          action={<Link to="/treino">Abrir</Link>}
        />
        <SignalCard
          icon={<Scale size={16} />}
          title="IMC"
          text={signals.imcOk ? 'No alvo' : 'Ajustar'}
          ok={signals.imcOk}
          action={
            <button type="button" onClick={onOpenBody}>
              Corpo
            </button>
          }
        />
      </motion.div>

      {weightSpark && (
        <section className="surface saude-trend">
          <div className="saude-trend__head">
            <strong>Peso</strong>
            <span>
              {lastWeightKg != null ? `${lastWeightKg} kg` : '—'}
              {projectionWeeks ? ` · ~${projectionWeeks} sem. até meta` : ''}
            </span>
          </div>
          <Sparkline points={weightSpark} />
        </section>
      )}

      <ActivityHeatmap log={moodLog} range="month" title="Humor do mês" />

      {todayCheckIn ? (
        <p className="saude-checkin-note">
          Check-in: energia {todayCheckIn.energy}/5 · humor {todayCheckIn.mood}
          /5
        </p>
      ) : (
        <button
          type="button"
          className="btn btn--ghost saude-checkin-cta"
          onClick={onOpenCheckin}
        >
          Fazer check-in de hoje
        </button>
      )}
    </div>
  )
}
