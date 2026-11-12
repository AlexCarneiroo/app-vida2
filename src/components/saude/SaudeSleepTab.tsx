import { Moon, Plus } from 'lucide-react'
import type { HealthInsight } from '../../data/saudeDefaults'
import type { SleepStats } from '../../data/saudeDefaults'
import type { SleepEntry, SleepQuality } from '../../types/saude'
import { Button } from '../ui/Button'
import { InsightList, StatTile } from './SaudeShared'

const DAY_LABEL = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export function SaudeSleepTab({
  sleepWeek,
  sleepAnalytics,
  sleepInsights,
  sleepDebt,
  sleepWeekDays,
  sleepDaysTarget,
  tonightSleep,
  reminderEnabled,
  reminderTime,
  onRegister,
  onOpenGoals,
}: {
  sleepWeek: {
    dateKey: string
    hours: number
    quality?: SleepQuality
  }[]
  sleepAnalytics: SleepStats
  sleepInsights: HealthInsight[]
  sleepDebt: number
  sleepWeekDays: number
  sleepDaysTarget: number
  tonightSleep: SleepEntry | null
  reminderEnabled: boolean
  reminderTime: string
  onRegister: () => void
  onOpenGoals: () => void
}) {
  const challengePct = Math.min(
    100,
    Math.round((sleepWeekDays / Math.max(1, sleepDaysTarget)) * 100),
  )

  return (
    <div className="saude-tab-panel">
      <section className="surface saude-module-hero is-sleep">
        <div>
          <p className="page-kicker">Módulo sono</p>
          <strong>
            {tonightSleep
              ? `${tonightSleep.hours}h registadas`
              : 'Ainda sem registo hoje'}
          </strong>
          <span>
            {tonightSleep?.bedTime && tonightSleep?.wakeTime
              ? `${tonightSleep.bedTime} → ${tonightSleep.wakeTime}`
              : 'Diário, horários, qualidade e disposição'}
            {tonightSleep?.quality
              ? ` · qualidade ${tonightSleep.quality}/5`
              : ''}
          </span>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={onRegister}
        >
          Registar
        </Button>
      </section>

      <div className="saude-stat-grid">
        <StatTile
          label="Média 14d"
          value={
            sleepAnalytics.avgHours != null
              ? `${sleepAnalytics.avgHours}h`
              : '—'
          }
          hint={
            sleepAnalytics.avgQuality != null
              ? `Qualidade ${sleepAnalytics.avgQuality}/5`
              : undefined
          }
        />
        <StatTile
          label="Débito"
          value={sleepDebt > 0 ? `~${sleepDebt}h` : '0h'}
          hint="vs 7.5h alvo"
        />
        <StatTile
          label="Sequência"
          value={`${sleepAnalytics.streak}d`}
          hint="noites ≥6.5h"
        />
        <StatTile
          label="Disposição"
          value={
            sleepAnalytics.avgReadiness != null
              ? `${sleepAnalytics.avgReadiness}/5`
              : '—'
          }
          hint="ao acordar"
        />
      </div>

      <section className="surface saude-challenge">
        <div className="saude-challenge__head">
          <div>
            <p className="page-kicker">Desafio semanal</p>
            <strong>
              {sleepWeekDays}/{sleepDaysTarget} noites 7–9h
            </strong>
          </div>
          <button type="button" className="btn btn--ghost" onClick={onOpenGoals}>
            Metas
          </button>
        </div>
        <div className="saude-challenge__bar" aria-hidden>
          <i style={{ width: `${challengePct}%` }} />
        </div>
        <span className="saude-challenge__hint">
          {challengePct >= 100
            ? 'Meta alcançada esta semana.'
            : `Faltam ${Math.max(0, sleepDaysTarget - sleepWeekDays)} noites no intervalo ideal.`}
        </span>
      </section>

      <section className="surface saude-sleep-week">
        <div className="saude-trend__head">
          <strong>Últimos 7 dias</strong>
          <span>{sleepAnalytics.loggedDays} registos em 14d</span>
        </div>
        <div className="saude-sleep-bars is-rich">
          {sleepWeek.map((d) => {
            const dow = new Date(`${d.dateKey}T12:00:00`).getDay()
            const ideal = d.hours >= 7 && d.hours <= 9
            return (
              <div
                key={d.dateKey}
                className={`saude-sleep-bar${d.hours > 0 ? ' has-data' : ''}${ideal ? ' is-ideal' : ''}`}
                title={
                  d.hours > 0
                    ? `${d.hours}h${d.quality ? ` · Q${d.quality}` : ''}`
                    : 'Sem registo'
                }
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

      <section className="surface saude-doc">
        <div className="saude-doc__head">
          <span className="saude-doc__avatar" aria-hidden>
            <Moon size={18} />
          </span>
          <div>
            <p className="page-kicker">Insights de sono</p>
            <strong>Padrões e alertas</strong>
            <span>
              Lembrete {reminderEnabled ? `ativo às ${reminderTime}` : 'desligado'}
            </span>
          </div>
        </div>
        <InsightList items={sleepInsights} />
      </section>

      <section className="surface saude-history">
        <div className="saude-trend__head">
          <strong>Histórico recente</strong>
          <button type="button" className="btn btn--ghost" onClick={onRegister}>
            Novo
          </button>
        </div>
        {sleepWeek.filter((d) => d.hours > 0).length === 0 ? (
          <p className="saude-empty">
            Ainda sem noites nesta semana. Regista a primeira para desbloquear
            gráficos e desafios.
          </p>
        ) : (
          <ul className="saude-history-list">
            {[...sleepWeek]
              .reverse()
              .filter((d) => d.hours > 0)
              .map((d) => (
                <li key={d.dateKey}>
                  <strong>
                    {d.dateKey.slice(8)}/{d.dateKey.slice(5, 7)}
                  </strong>
                  <span>
                    {d.hours}h
                    {d.quality ? ` · qualidade ${d.quality}/5` : ''}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  )
}
