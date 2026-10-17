import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  CalendarRange,
  Dumbbell,
  FileDown,
  Gamepad2,
  PiggyBank,
  Repeat,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/Feedback'
import { PageTransition } from '../components/ui/PageTransition'
import { useBusyAction } from '../hooks/useBusyAction'
import { useFinancas } from '../hooks/useFinancas'
import { useHabitos } from '../hooks/useHabitos'
import { useJogos } from '../hooks/useJogos'
import { useNutricao } from '../hooks/useNutricao'
import { useRotina } from '../hooks/useRotina'
import { useSaude } from '../hooks/useSaude'
import { useTreino } from '../hooks/useTreino'
import { dateKey } from '../lib/date'
import { exportVidaReportPdf } from '../lib/vidaReportExport'
import {
  REPORT_SECTION_ORDER,
  buildVidaReport,
  rangeWindow,
  reportHighlights,
  type ReportRange,
  type ReportSectionId,
} from '../lib/vidaReport'

const RANGES: Array<{ id: ReportRange; label: string }> = [
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mês' },
  { id: 'year', label: 'Ano' },
  { id: 'custom', label: 'Datas' },
]

const FILTERS: Array<{ id: ReportSectionId; label: string }> = [
  { id: 'treino', label: 'Treino' },
  { id: 'habitos', label: 'Hábitos' },
  { id: 'financas', label: 'Finanças' },
  { id: 'rotina', label: 'Rotina' },
  { id: 'nutricao', label: 'Nutrição' },
  { id: 'saude', label: 'Saúde' },
  { id: 'jogos', label: 'Jogos' },
]

const ICONS: Record<ReportSectionId, LucideIcon> = {
  treino: Dumbbell,
  habitos: Sparkles,
  financas: PiggyBank,
  rotina: Repeat,
  nutricao: UtensilsCrossed,
  saude: Activity,
  jogos: Gamepad2,
}

export function RelatorioPage() {
  const { toast } = useToast()
  const { busy: exporting, run: runExport } = useBusyAction()
  const [range, setRange] = useState<ReportRange>('month')
  const [customStart, setCustomStart] = useState(() => rangeWindow('month').startKey)
  const [customEnd, setCustomEnd] = useState(() => dateKey())
  const [picked, setPicked] = useState<ReportSectionId[]>(REPORT_SECTION_ORDER)

  const { state: treino } = useTreino()
  const { habits, personalGoals, dayLog: habitsLog } = useHabitos()
  const { dayLog: rotinaLog, total: rotinaBlocks } = useRotina()
  const { state: nutri } = useNutricao()
  const { state: finance } = useFinancas()
  const { state: saude } = useSaude()
  const { state: jogos } = useJogos()

  const window = useMemo(
    () =>
      rangeWindow(range, new Date(), {
        startKey: customStart,
        endKey: customEnd,
      }),
    [customEnd, customStart, range],
  )

  const sections = useMemo(
    () =>
      buildVidaReport({
        startKey: window.startKey,
        endKey: window.endKey,
        history: treino.history,
        habits,
        personalGoals,
        habitsLog,
        rotinaLog,
        rotinaBlocks,
        nutri,
        transactions: finance.transactions,
        goals: finance.goals ?? [],
        bills: finance.bills ?? [],
        saude,
        gameSessions: jogos.sessions ?? [],
      }),
    [
      finance.bills,
      finance.goals,
      finance.transactions,
      habits,
      habitsLog,
      jogos.sessions,
      nutri,
      personalGoals,
      rotinaBlocks,
      rotinaLog,
      saude,
      treino.history,
      window.endKey,
      window.startKey,
    ],
  )

  const visible = sections.filter((section) => picked.includes(section.id))
  const highlights = reportHighlights(visible)
  const allOn = picked.length === REPORT_SECTION_ORDER.length

  function toggleSection(id: ReportSectionId) {
    setPicked((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev
        return prev.filter((item) => item !== id)
      }
      return REPORT_SECTION_ORDER.filter(
        (item) => item === id || prev.includes(item),
      )
    })
  }

  function setDate(which: 'start' | 'end', value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return
    if (which === 'start') setCustomStart(value)
    else setCustomEnd(value)
    setRange('custom')
  }

  async function handleExport() {
    await runExport(async () => {
      await exportVidaReportPdf({
        label: window.label,
        startKey: window.startKey,
        endKey: window.endKey,
        sections: visible,
      })
      toast('Relatório exportado', 'ok')
    })
  }

  return (
    <PageTransition>
      <header className="page-header">
        <div>
          <p className="page-kicker">Panorama</p>
          <h1 className="page-title">Relatório</h1>
          <p className="page-sub">
            {window.label}
            {' · '}
            {window.days} dia{window.days === 1 ? '' : 's'}
          </p>
        </div>
        <Button
          variant="primary"
          icon={<FileDown size={16} />}
          loading={exporting}
          loadingLabel="A exportar…"
          onClick={() => void handleExport()}
        >
          Exportar PDF
        </Button>
      </header>

      <div className="report-tabs" role="tablist" aria-label="Período">
        {RANGES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={range === item.id}
            className={range === item.id ? 'is-active' : ''}
            onClick={() => setRange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {range === 'custom' && (
        <div className="report-dates">
          <label className="plan-field">
            <span>De</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setDate('start', e.target.value)}
            />
          </label>
          <label className="plan-field">
            <span>Até</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setDate('end', e.target.value)}
            />
          </label>
        </div>
      )}

      <div className="report-filters" role="group" aria-label="Secções do relatório">
        <button
          type="button"
          className={allOn ? 'is-active' : ''}
          onClick={() => setPicked(REPORT_SECTION_ORDER)}
        >
          Tudo
        </button>
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={picked.includes(item.id)}
            className={picked.includes(item.id) ? 'is-active' : ''}
            onClick={() => toggleSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {highlights.length > 0 && (
        <section className="surface report-highlights">
          <p className="report-highlights__kicker">
            <CalendarRange size={14} aria-hidden />
            O que se destaca
          </p>
          <ul>
            {highlights.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="report-grid">
        {visible.map((section) => {
          const Icon = ICONS[section.id]
          return (
            <Link
              key={section.id}
              to={section.to}
              className="surface report-card"
            >
              <span
                className="report-card__icon"
                style={{ color: `var(--${section.id})` }}
              >
                <Icon size={18} />
              </span>
              <strong>{section.headline}</strong>
              <span>{section.caption}</span>
              <em>{section.note}</em>
              {section.rows.length > 0 && (
                <ul>
                  {section.rows.slice(0, 6).map((row) => (
                    <li key={`${section.id}-${row.label}`}>
                      <span>{row.label}</span>
                      <b>{row.value}</b>
                    </li>
                  ))}
                </ul>
              )}
            </Link>
          )
        })}
      </section>

      {visible
        .filter((section) => section.items.length > 0)
        .map((section) => (
          <section key={`${section.id}-items`} className="surface report-list">
            <h2>{section.title}</h2>
            <ul>
              {section.items.slice(0, 8).map((item) => (
                <li key={`${section.id}-${item.label}-${item.value}`}>
                  <span>{item.label}</span>
                  <b>{item.value}</b>
                </li>
              ))}
            </ul>
            {section.items.length > 8 && (
              <p>
                Mais {section.items.length - 8} no PDF.
              </p>
            )}
          </section>
        ))}

      <section className="surface report-note">
        <p>
          {visible.every((section) => section.empty)
            ? 'Ainda não há movimento nestas secções. O PDF exporta mesmo assim, só com o período escolhido.'
            : 'O PDF leva o período e só as secções que estão ligadas nos filtros.'}
        </p>
      </section>
    </PageTransition>
  )
}
