import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarRange,
  Dumbbell,
  PiggyBank,
  Repeat,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react'
import { PageTransition } from '../components/ui/PageTransition'
import { useFinancas } from '../hooks/useFinancas'
import { useHabitos } from '../hooks/useHabitos'
import { useNutricao } from '../hooks/useNutricao'
import { useRotina } from '../hooks/useRotina'
import { useTreino } from '../hooks/useTreino'
import { formatBRL } from '../lib/date'
import {
  financeReport,
  rangeWindow,
  sumDayLog,
  treinoReport,
  type ReportRange,
} from '../lib/vidaReport'

const RANGES: Array<{ id: ReportRange; label: string }> = [
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mês' },
  { id: 'year', label: 'Ano' },
]

export function RelatorioPage() {
  const [range, setRange] = useState<ReportRange>('week')
  const { state: treino } = useTreino()
  const { dayLog: habitsLog, personalGoals } = useHabitos()
  const { dayLog: rotinaLog } = useRotina()
  const { state: nutri } = useNutricao()
  const { state: finance } = useFinancas()

  const window = useMemo(() => rangeWindow(range), [range])
  const treinos = useMemo(
    () => treinoReport(treino.history, window.startKey, window.endKey),
    [treino.history, window.endKey, window.startKey],
  )
  const habits = useMemo(
    () => sumDayLog(habitsLog, window.startKey, window.endKey),
    [habitsLog, window.endKey, window.startKey],
  )
  const rotina = useMemo(
    () => sumDayLog(rotinaLog, window.startKey, window.endKey),
    [rotinaLog, window.endKey, window.startKey],
  )
  const food = useMemo(
    () => sumDayLog(nutri.dayLog ?? {}, window.startKey, window.endKey),
    [nutri.dayLog, window.endKey, window.startKey],
  )
  const money = useMemo(
    () => financeReport(finance.transactions, window.startKey, window.endKey),
    [finance.transactions, window.endKey, window.startKey],
  )

  const goalsDone = personalGoals.filter((g) => g.completedAt).length

  return (
    <PageTransition>
      <header className="page-header">
        <div>
          <p className="page-kicker">Panorama</p>
          <h1 className="page-title">Relatório</h1>
          <p className="page-sub">{window.label}</p>
        </div>
        <span className="config-version-chip" aria-hidden>
          <CalendarRange size={14} />
        </span>
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

      <section className="report-grid">
        <Link to="/treino" className="surface report-card">
          <span className="report-card__icon" style={{ color: 'var(--treino)' }}>
            <Dumbbell size={18} />
          </span>
          <strong>{treinos.sessions}</strong>
          <span>Treinos concluídos</span>
          <em>{treinos.volume > 0 ? `${treinos.volume} kg de volume` : 'Sem volume ainda'}</em>
        </Link>

        <Link to="/habitos" className="surface report-card">
          <span className="report-card__icon" style={{ color: 'var(--habitos)' }}>
            <Sparkles size={18} />
          </span>
          <strong>{habits.total}</strong>
          <span>Hábitos assinalados</span>
          <em>
            {habits.days} dia{habits.days === 1 ? '' : 's'} com registo
            {goalsDone > 0 ? ` · ${goalsDone} meta${goalsDone === 1 ? '' : 's'} fechada${goalsDone === 1 ? '' : 's'}` : ''}
          </em>
        </Link>

        <Link to="/financas" className="surface report-card">
          <span className="report-card__icon" style={{ color: 'var(--financas)' }}>
            <PiggyBank size={18} />
          </span>
          <strong>{formatBRL(money.balance)}</strong>
          <span>Saldo do período</span>
          <em>
            +{formatBRL(money.income)} · −{formatBRL(money.expense)} · {money.movements} mov.
          </em>
        </Link>

        <Link to="/rotina" className="surface report-card">
          <span className="report-card__icon" style={{ color: 'var(--rotina)' }}>
            <Repeat size={18} />
          </span>
          <strong>{rotina.total}</strong>
          <span>Blocos de rotina</span>
          <em>
            {rotina.days} dia{rotina.days === 1 ? '' : 's'} com rotina feita
          </em>
        </Link>

        <Link to="/nutricao" className="surface report-card">
          <span className="report-card__icon" style={{ color: 'var(--nutricao)' }}>
            <UtensilsCrossed size={18} />
          </span>
          <strong>{food.total > 0 ? food.total.toLocaleString('pt-BR') : '0'}</strong>
          <span>kcal registadas</span>
          <em>
            {food.days} dia{food.days === 1 ? '' : 's'} com prato
            {food.days > 0 ? ` · média ${Math.round(food.total / food.days)} kcal` : ''}
          </em>
        </Link>
      </section>

      <section className="surface report-note">
        <p>
          {treinos.sessions === 0 && habits.total === 0 && money.movements === 0 && food.total === 0
            ? 'Ainda não há movimento neste período. Treina, marca um hábito ou regista um valor — o relatório enche sozinho.'
            : range === 'week'
              ? 'Esta é a fotografia da tua semana. Se um pilar ficou atrás, é o primeiro a atacar amanhã.'
              : range === 'month'
                ? 'O mês mostra o hábito por baixo do dia. Procura consistência, não um pico isolado.'
                : 'O ano é a soma dos dias em que não desististe. Continua a construir.'}
        </p>
      </section>
    </PageTransition>
  )
}
