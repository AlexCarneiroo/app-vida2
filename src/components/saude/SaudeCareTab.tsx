import {
  Activity,
  ClipboardList,
  Pill,
  Stethoscope,
} from 'lucide-react'
import type { Medication, ProNote, QuickConsult } from '../../types/saude'
import { Button } from '../ui/Button'

export function SaudeCareTab({
  today,
  medications,
  todayCheckIn,
  lastConsult,
  proNotes,
  waterDaysTarget,
  sleepDaysTarget,
  waterWeekDays,
  sleepWeekDays,
  reminderEnabled,
  reminderTime,
  onToggleMed,
  onOpenMeds,
  onOpenCheckin,
  onOpenConsult,
  onOpenGoals,
}: {
  today: string
  medications: Medication[]
  todayCheckIn: { energy: number; mood: number; symptoms?: string } | null
  lastConsult: QuickConsult | null
  proNotes: ProNote[]
  waterDaysTarget: number
  sleepDaysTarget: number
  waterWeekDays: number
  sleepWeekDays: number
  reminderEnabled: boolean
  reminderTime: string
  onToggleMed: (id: string) => void
  onOpenMeds: () => void
  onOpenCheckin: () => void
  onOpenConsult: () => void
  onOpenGoals: () => void
}) {
  const enabledMeds = medications.filter((m) => m.enabled)

  return (
    <div className="saude-tab-panel">
      <section className="surface saude-module-hero is-care">
        <div>
          <p className="page-kicker">Cuidado diário</p>
          <strong>Medicação, check-in e consulta</strong>
          <span>Rotina leve para manter o painel vivo</span>
        </div>
        <Button variant="primary" icon={<Activity size={16} />} onClick={onOpenCheckin}>
          Check-in
        </Button>
      </section>

      <div className="saude-care-actions">
        <button type="button" className="surface saude-care-card" onClick={onOpenMeds}>
          <Pill size={18} />
          <strong>Medicação</strong>
          <span>{enabledMeds.length} ativos</span>
        </button>
        <button type="button" className="surface saude-care-card" onClick={onOpenConsult}>
          <ClipboardList size={18} />
          <strong>Consulta rápida</strong>
          <span>3 perguntas → plano</span>
        </button>
        <button type="button" className="surface saude-care-card" onClick={onOpenGoals}>
          <Stethoscope size={18} />
          <strong>Metas & lembretes</strong>
          <span>
            {reminderEnabled ? `Sono ${reminderTime}` : 'Sem lembrete de sono'}
          </span>
        </button>
      </div>

      <section className="surface saude-meds-today">
        <div className="saude-trend__head">
          <strong>Medicação de hoje</strong>
          <button type="button" className="btn btn--ghost" onClick={onOpenMeds}>
            Gerir
          </button>
        </div>
        {enabledMeds.length === 0 ? (
          <p className="saude-empty">
            Adiciona suplementos ou medicamentos com horário para marcar como
            tomados.
          </p>
        ) : (
          <ul>
            {enabledMeds.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className={`saude-med-check${m.lastTakenDateKey === today ? ' is-done' : ''}`}
                  onClick={() => onToggleMed(m.id)}
                >
                  {m.time} · {m.name}
                  {m.dose ? ` · ${m.dose}` : ''}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface saude-history">
        <div className="saude-trend__head">
          <strong>Check-in</strong>
          <button type="button" className="btn btn--ghost" onClick={onOpenCheckin}>
            {todayCheckIn ? 'Atualizar' : 'Fazer'}
          </button>
        </div>
        {todayCheckIn ? (
          <p className="saude-checkin-note" style={{ margin: 0 }}>
            Energia {todayCheckIn.energy}/5 · humor {todayCheckIn.mood}/5
            {todayCheckIn.symptoms ? ` · ${todayCheckIn.symptoms}` : ''}
          </p>
        ) : (
          <p className="saude-empty">
            Regista energia, humor e sintomas em menos de um minuto.
          </p>
        )}
      </section>

      <section className="surface saude-challenge">
        <div className="saude-challenge__head">
          <div>
            <p className="page-kicker">Metas da semana</p>
            <strong>
              Água {waterWeekDays}/{waterDaysTarget} · Sono {sleepWeekDays}/
              {sleepDaysTarget}
            </strong>
          </div>
          <button type="button" className="btn btn--ghost" onClick={onOpenGoals}>
            Editar
          </button>
        </div>
      </section>

      {(lastConsult || proNotes.length > 0) && (
        <section className="surface saude-doc">
          <div className="saude-doc__head">
            <span className="saude-doc__avatar" aria-hidden>
              <ClipboardList size={18} />
            </span>
            <div>
              <p className="page-kicker">Consultório</p>
              <strong>Planos e notas</strong>
              <span>Última orientação guardada</span>
            </div>
          </div>
          {lastConsult && (
            <div className="saude-consult-plan">
              <strong>Plano · {lastConsult.dateKey}</strong>
              <ul>
                {lastConsult.plan.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {proNotes.length > 0 && (
            <ul className="saude-history-list">
              {proNotes.slice(0, 4).map((n) => (
                <li key={n.id}>
                  <strong>{n.author}</strong>
                  <span>{n.body}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
