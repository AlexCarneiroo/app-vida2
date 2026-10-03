import { motion } from 'framer-motion'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Loader2,
  Pencil,
  PieChart,
  PiggyBank,
  Plus,
  RefreshCw,
  Target,
  Trash2,
  Wallet,
} from 'lucide-react'
import { lazy, Suspense, useMemo, useState, type FormEvent } from 'react'
import { ImportBankButton } from '../components/financas/ImportBankButton'
import { Button } from '../components/ui/Button'
import {
  PageTransition,
  staggerContainer,
  staggerItem,
} from '../components/ui/PageTransition'
import { PageHeader, PageScreens } from '../components/ui/PageShell'
import { useConfirm, useToast } from '../components/ui/Feedback'
import {
  BILL_IDEAS,
  CATEGORY_LABELS,
  categoriesForType,
  clampBillDay,
  EXPENSE_CATEGORIES,
} from '../data/financasDefaults'
import { useBusyAction } from '../hooks/useBusyAction'
import { useFinancas } from '../hooks/useFinancas'
import { useHabitos } from '../hooks/useHabitos'
import type { ImportDraft } from '../lib/bankImport'
import { BILL_STATUS_LABEL } from '../lib/billStatus'
import {
  dateKey,
  formatBRL,
  formatDateBR,
  parseBRLInput,
  sanitizeMoneyTyping,
} from '../lib/date'
import { exportMonthPdf } from '../lib/financeExport'
import type { FinanceCategory, RecurringBill, TxType } from '../types/financas'

const ImportReview = lazy(() =>
  import('../components/financas/ImportReview').then((m) => ({
    default: m.ImportReview,
  })),
)

function defaultTxDateForMonth(selectedMonth: string) {
  const today = dateKey()
  if (today.startsWith(selectedMonth)) return today
  return `${selectedMonth}-01`
}

type ImportSession = {
  drafts: ImportDraft[]
  detectedMonth: string | null
  warnings: string[]
  source: string
}

export function FinancasPage() {
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const { busy: savingTx, run: runSaveTx } = useBusyAction()
  const { busy: savingGoal, run: runSaveGoal } = useBusyAction()
  const { busy: savingBill, run: runSaveBill } = useBusyAction()
  const { busy: savingBudget, run: runSaveBudget } = useBusyAction()
  const { busy: exporting, run: runExport } = useBusyAction()
  const [removingTxId, setRemovingTxId] = useState<string | null>(null)
  const [removingGoalId, setRemovingGoalId] = useState<string | null>(null)
  const [removingBillId, setRemovingBillId] = useState<string | null>(null)
  const [removingBudgetId, setRemovingBudgetId] = useState<string | null>(null)
  const [payingBillId, setPayingBillId] = useState<string | null>(null)
  const [addingGoalId, setAddingGoalId] = useState<string | null>(null)
  const [calendarDays, setCalendarDays] = useState<7 | 30>(7)
  const {
    state,
    monthKey,
    monthLabel,
    monthTransactions,
    stats,
    bills,
    billsMonthlyTotal,
    billsCalendar7,
    billsCalendar30,
    budgetProgress,
    getBillStatus,
    addTransaction,
    removeTransaction,
    importTransactions,
    addGoal,
    updateGoalSaved,
    removeGoal,
    addBill,
    updateBill,
    removeBill,
    markBillPaid,
    upsertBudget,
    removeBudget,
    shiftMonth,
    setMonth,
  } = useFinancas()
  const { habits } = useHabitos()

  const habitsByGoal = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const h of habits) {
      if (!h.linkedGoalId) continue
      const list = map.get(h.linkedGoalId) ?? []
      list.push(h.name)
      map.set(h.linkedGoalId, list)
    }
    return map
  }, [habits])

  const goals = state.goals
  const [type, setType] = useState<TxType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<FinanceCategory>('alimentação')
  const [note, setNote] = useState('')
  const [txDate, setTxDate] = useState(() => dateKey())
  const [goalName, setGoalName] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const [goalAdds, setGoalAdds] = useState<Record<string, string>>({})
  const [view, setView] = useState<
    'home' | 'tx' | 'goal' | 'bill' | 'budget'
  >('home')
  const [importSession, setImportSession] = useState<ImportSession | null>(null)
  const [editingBillId, setEditingBillId] = useState<string | null>(null)
  const [billName, setBillName] = useState('')
  const [billAmount, setBillAmount] = useState('')
  const [billDay, setBillDay] = useState('5')
  const [billCategory, setBillCategory] =
    useState<FinanceCategory>('lazer')
  const [billActive, setBillActive] = useState(true)
  const [budgetCategory, setBudgetCategory] =
    useState<FinanceCategory>('alimentação')
  const [budgetLimit, setBudgetLimit] = useState('')

  const cats = useMemo(() => categoriesForType(type), [type])
  const onPanel = view !== 'home'
  const calendarItems =
    calendarDays === 7 ? billsCalendar7 : billsCalendar30
  const usedBudgetCats = useMemo(
    () => new Set(budgetProgress.map((b) => b.category)),
    [budgetProgress],
  )
  const freeBudgetCats = useMemo(
    () => EXPENSE_CATEGORIES.filter((c) => !usedBudgetCats.has(c)),
    [usedBudgetCats],
  )

  function handleTypeChange(next: TxType) {
    setType(next)
    setCategory(categoriesForType(next)[0])
  }

  function openTxForm() {
    setTxDate(defaultTxDateForMonth(monthKey))
    setAmount('')
    setNote('')
    setView('tx')
  }

  function openGoalForm() {
    setView('goal')
  }

  function openBudgetForm() {
    setBudgetCategory(freeBudgetCats[0] ?? 'alimentação')
    setBudgetLimit('')
    setView('budget')
  }

  function handleSaveBudget(e: FormEvent) {
    e.preventDefault()
    const limit = parseBRLInput(budgetLimit)
    if (!limit) return
    void runSaveBudget(() => {
      upsertBudget(budgetCategory, limit)
      setBudgetLimit('')
      setView('home')
      toast('Orçamento definido', 'ok')
    })
  }

  async function handleRemoveBudget(id: string, label: string) {
    const ok = await confirm({
      title: 'Remover orçamento?',
      message: `O teto de ${label} deixa de ser acompanhado.`,
      confirmLabel: 'Remover',
    })
    if (!ok) return
    setRemovingBudgetId(id)
    try {
      removeBudget(id)
      toast('Orçamento removido', 'info')
    } finally {
      setRemovingBudgetId(null)
    }
  }

  function resetBillForm() {
    setEditingBillId(null)
    setBillName('')
    setBillAmount('')
    setBillDay('5')
    setBillCategory('lazer')
    setBillActive(true)
  }

  function openBillForm(bill?: RecurringBill) {
    if (bill) {
      setEditingBillId(bill.id)
      setBillName(bill.name)
      setBillAmount(String(bill.amount).replace('.', ','))
      setBillDay(String(bill.dayOfMonth))
      setBillCategory(bill.category)
      setBillActive(bill.active)
    } else {
      resetBillForm()
    }
    setView('bill')
  }

  function applyBillIdea(idea: (typeof BILL_IDEAS)[number]) {
    setEditingBillId(null)
    setBillName(idea.name)
    setBillAmount(String(idea.amount).replace('.', ','))
    setBillDay(String(idea.dayOfMonth))
    setBillCategory(idea.category)
    setBillActive(true)
    setView('bill')
  }

  function closePanel() {
    setView('home')
    resetBillForm()
  }

  function handleAddTx(e: FormEvent) {
    e.preventDefault()
    const value = parseBRLInput(amount)
    if (!value || !txDate) return
    void runSaveTx(() => {
      addTransaction({
        type,
        amount: value,
        category,
        note,
        dateKey: txDate,
      })
      const txMonth = txDate.slice(0, 7)
      if (txMonth !== monthKey) setMonth(txMonth)
      setAmount('')
      setNote('')
      setView('home')
      toast(
        type === 'income' ? 'Entrada adicionada' : 'Saída adicionada',
        'ok',
      )
    })
  }

  function handleAddGoal(e: FormEvent) {
    e.preventDefault()
    const target = parseBRLInput(goalTarget)
    if (!goalName.trim() || !target) return
    void runSaveGoal(() => {
      addGoal(goalName, target)
      setGoalName('')
      setGoalTarget('')
      setView('home')
      toast('Meta criada', 'ok')
    })
  }

  function handleSaveBill(e: FormEvent) {
    e.preventDefault()
    const value = parseBRLInput(billAmount)
    if (!billName.trim() || !value) return
    void runSaveBill(() => {
      const payload = {
        name: billName,
        amount: value,
        dayOfMonth: clampBillDay(Number(billDay) || 1),
        category: billCategory,
        active: billActive,
      }
      if (editingBillId) {
        updateBill(editingBillId, payload)
        toast('Assinatura atualizada', 'ok')
      } else {
        addBill(payload)
        toast('Assinatura adicionada', 'ok')
      }
      resetBillForm()
      setView('home')
    })
  }

  function handlePayBill(bill: RecurringBill) {
    setPayingBillId(bill.id)
    try {
      markBillPaid(bill.id)
      toast(`${bill.name} marcada como paga`, 'ok')
    } finally {
      setPayingBillId(null)
    }
  }

  async function handleRemoveBill(bill: RecurringBill) {
    const ok = await confirm({
      title: 'Excluir assinatura?',
      message: `“${bill.name}” deixa de aparecer nas contas fixas.`,
      confirmLabel: 'Excluir',
    })
    if (!ok) return
    setRemovingBillId(bill.id)
    try {
      removeBill(bill.id)
      toast('Assinatura removida', 'info')
    } finally {
      setRemovingBillId(null)
    }
  }

  async function handleRemoveTx(id: string) {
    const ok = await confirm({
      title: 'Excluir movimento?',
      message: 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
    })
    if (!ok) return
    setRemovingTxId(id)
    try {
      removeTransaction(id)
      toast('Movimento excluído', 'info')
    } finally {
      setRemovingTxId(null)
    }
  }

  async function handleRemoveGoal(id: string, name: string) {
    const ok = await confirm({
      title: 'Excluir meta?',
      message: `A meta “${name}” será removida.`,
      confirmLabel: 'Excluir',
    })
    if (!ok) return
    setRemovingGoalId(id)
    try {
      removeGoal(id)
      toast('Meta excluída', 'info')
    } finally {
      setRemovingGoalId(null)
    }
  }

  function addToGoal(id: string, delta: number) {
    const goal = goals.find((g) => g.id === id)
    if (!goal || delta <= 0) return
    setAddingGoalId(id)
    updateGoalSaved(id, goal.saved + delta)
    toast(`+${formatBRL(delta)} na meta`, 'ok')
    window.setTimeout(() => setAddingGoalId(null), 280)
  }

  if (importSession) {
    return (
      <PageTransition>
        <Suspense
          fallback={
            <div className="route-fallback" role="status">
              A preparar importação…
            </div>
          }
        >
          <ImportReview
            drafts={importSession.drafts}
            detectedMonth={importSession.detectedMonth}
            warnings={importSession.warnings}
            source={importSession.source}
            onCancel={() => setImportSession(null)}
            onSave={(items) => {
              const n = importTransactions(items)
              setImportSession(null)
              toast(
                n === 1
                  ? '1 movimento importado'
                  : `${n} movimentos importados`,
                'ok',
              )
            }}
          />
        </Suspense>
      </PageTransition>
    )
  }

  const panelMeta =
    view === 'tx'
      ? {
          title: 'Novo movimento',
          sub: 'Regista uma entrada ou saída deste mês.',
        }
      : view === 'goal'
        ? {
            title: 'Nova meta',
            sub: 'Define um objetivo de poupança.',
          }
        : view === 'bill'
          ? {
              title: editingBillId ? 'Editar assinatura' : 'Nova assinatura',
              sub: 'Dia de renovação, valor e categoria — avisamos se atrasar.',
            }
          : view === 'budget'
            ? {
                title: 'Orçamento do mês',
                sub: 'Define um teto por categoria (ex.: alimentação R$ 800).',
              }
            : null

  return (
    <PageTransition>
      <PageHeader
        kicker="Dinheiro"
        title={panelMeta?.title ?? 'Finanças'}
        sub={
          panelMeta?.sub ??
          'Importa CSV, OFX, TXT ou PDF do banco, confere e guarda. Também exporta o mês em PDF.'
        }
        onBack={onPanel ? closePanel : undefined}
        action={
          <div className="finance-header-actions">
            <ImportBankButton
              onParsed={(result) => {
                setImportSession(result)
                toast('Ficheiro lido — confere os movimentos', 'info')
              }}
              onError={(message) => toast(message, 'warn')}
            />
            <Button
              variant="ghost"
              icon={<FileDown size={16} />}
              loading={exporting}
              loadingLabel="A exportar…"
              onClick={() => {
                void runExport(async () => {
                  await exportMonthPdf({
                    monthKey,
                    transactions: monthTransactions,
                    stats,
                  })
                  toast('PDF exportado', 'ok')
                })
              }}
            >
              PDF
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={openTxForm}
              disabled={savingTx}
            >
              Adicionar
            </Button>
          </div>
        }
      />

      <PageScreens
        mode={view}
        home={
          <>
      <div className="finance-month-nav">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => shiftMonth(-1)}
          aria-label="Mês anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <strong>{monthLabel}</strong>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => shiftMonth(1)}
          aria-label="Próximo mês"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <motion.div
        className="finance-stats"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.div className="surface finance-stat" variants={staggerItem}>
          <span className="finance-stat__icon is-in">
            <ArrowDownLeft size={16} />
          </span>
          <div>
            <p className="page-kicker">Entradas</p>
            <strong className="is-in">{formatBRL(stats.income)}</strong>
          </div>
        </motion.div>
        <motion.div className="surface finance-stat" variants={staggerItem}>
          <span className="finance-stat__icon is-out">
            <ArrowUpRight size={16} />
          </span>
          <div>
            <p className="page-kicker">Saídas</p>
            <strong className="is-out">{formatBRL(stats.expense)}</strong>
          </div>
        </motion.div>
        <motion.div className="surface finance-stat" variants={staggerItem}>
          <span className="finance-stat__icon">
            <Wallet size={16} />
          </span>
          <div>
            <p className="page-kicker">Saldo</p>
            <strong className={stats.balance >= 0 ? 'is-in' : 'is-out'}>
              {formatBRL(stats.balance)}
            </strong>
          </div>
        </motion.div>
      </motion.div>

      {stats.byCategory.length > 0 && (
        <>
          <div className="section-label">
            <h2>Por categoria</h2>
            <span>Saídas do mês</span>
          </div>
          <div className="finance-cats">
            {stats.byCategory.slice(0, 6).map((row) => {
              const pct =
                stats.expense > 0
                  ? Math.round((row.total / stats.expense) * 100)
                  : 0
              return (
                <div key={row.category} className="surface finance-cat-row">
                  <div className="finance-cat-row__top">
                    <strong>{CATEGORY_LABELS[row.category]}</strong>
                    <span>
                      {formatBRL(row.total)}
                      <em>{pct}%</em>
                    </span>
                  </div>
                  <div
                    className="finance-meter"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span
                      className="finance-meter__fill finance-meter__fill--cat"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="section-label">
        <h2>Movimentos</h2>
        <span>{monthTransactions.length} no mês</span>
      </div>

      {monthTransactions.length === 0 ? (
        <div className="surface finance-empty">
          <PiggyBank size={24} />
          <p>
            Ainda sem movimentos neste mês. Adiciona a primeira entrada ou
            saída.
          </p>
        </div>
      ) : (
        <div className="finance-list">
          {monthTransactions.map((tx) => (
            <div key={tx.id} className="surface finance-row">
              <span
                className={`finance-row__icon${tx.type === 'income' ? ' is-in' : ' is-out'}`}
              >
                {tx.type === 'income' ? (
                  <ArrowDownLeft size={16} />
                ) : (
                  <ArrowUpRight size={16} />
                )}
              </span>
              <div className="finance-row__info">
                <strong>{CATEGORY_LABELS[tx.category]}</strong>
                <span>
                  {formatDateBR(tx.dateKey)}
                  {tx.note ? ` · ${tx.note}` : ''}
                </span>
              </div>
              <em className={tx.type === 'income' ? 'is-in' : 'is-out'}>
                {tx.type === 'income' ? '+' : '−'}
                {formatBRL(tx.amount)}
              </em>
              <Button
                variant="ghost"
                className="finance-row__del"
                icon={<Trash2 size={14} />}
                loading={removingTxId === tx.id}
                onClick={() => handleRemoveTx(tx.id)}
                title="Remover"
                aria-label="Remover movimento"
              />
            </div>
          ))}
        </div>
      )}

      <div className="section-label">
        <h2>Vencimentos</h2>
        <div className="finance-cal-toggle" role="group" aria-label="Horizonte">
          <button
            type="button"
            className={`rest-prefs__btn${calendarDays === 7 ? ' is-active' : ''}`}
            onClick={() => setCalendarDays(7)}
          >
            7 dias
          </button>
          <button
            type="button"
            className={`rest-prefs__btn${calendarDays === 30 ? ' is-active' : ''}`}
            onClick={() => setCalendarDays(30)}
          >
            30 dias
          </button>
        </div>
      </div>

      {calendarItems.length === 0 ? (
        <p className="finance-cal-empty">
          Sem vencimentos neste período. Adiciona assinaturas abaixo.
        </p>
      ) : (
        <div className="finance-cal" role="list">
          {calendarItems.map((item) => (
            <button
              key={`${item.bill.id}-${item.dateKey}`}
              type="button"
              className={`finance-cal__item is-${item.status}`}
              role="listitem"
              onClick={() => {
                if (item.status !== 'paid') handlePayBill(item.bill)
              }}
            >
              <span className="finance-cal__day">
                <Calendar size={12} aria-hidden />
                {item.daysUntil < 0
                  ? `${Math.abs(item.daysUntil)}d atraso`
                  : item.daysUntil === 0
                    ? 'Hoje'
                    : item.daysUntil === 1
                      ? 'Amanhã'
                      : `em ${item.daysUntil}d`}
              </span>
              <strong>{item.bill.name}</strong>
              <em>{formatBRL(item.bill.amount)}</em>
            </button>
          ))}
        </div>
      )}

      <div className="section-label">
        <h2>Assinaturas</h2>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => openBillForm()}
        >
          <Plus size={14} />
          Nova
        </button>
      </div>

      {bills.length > 0 && (
        <p className="finance-bills-total">
          <RefreshCw size={14} aria-hidden />
          {formatBRL(billsMonthlyTotal)} / mês em contas fixas
        </p>
      )}

      <div className="habit-ideas" aria-label="Ideias de assinaturas">
        {BILL_IDEAS.map((idea) => (
          <button
            key={idea.name}
            type="button"
            className="habit-idea"
            onClick={() => applyBillIdea(idea)}
          >
            {idea.name}
          </button>
        ))}
      </div>

      {bills.length === 0 ? (
        <div className="surface finance-empty finance-empty--compact">
          <RefreshCw size={22} />
          <p>
            Netflix, academia, luz… regista o dia de renovação e vê o que está
            atrasado.
          </p>
        </div>
      ) : (
        <div className="finance-bills">
          {bills.map((bill) => {
            const status = getBillStatus(bill)
            return (
              <article
                key={bill.id}
                className={`surface finance-bill is-${status}${!bill.active ? ' is-paused' : ''}`}
              >
                <div className="finance-bill__main">
                  <span className="finance-bill__icon" aria-hidden>
                    <RefreshCw size={16} />
                  </span>
                  <div className="finance-bill__info">
                    <strong>{bill.name}</strong>
                    <span>
                      Renova dia {bill.dayOfMonth}
                      {' · '}
                      {CATEGORY_LABELS[bill.category]}
                      {!bill.active ? ' · Pausada' : ''}
                    </span>
                  </div>
                  <em className="finance-bill__amount">
                    {formatBRL(bill.amount)}
                  </em>
                </div>
                <div className="finance-bill__foot">
                  <span className={`finance-bill__badge is-${status}`}>
                    {!bill.active ? 'Pausada' : BILL_STATUS_LABEL[status]}
                  </span>
                  <div className="finance-bill__actions">
                    {bill.active && status !== 'paid' && (
                      <button
                        type="button"
                        className="btn btn--primary finance-bill__pay"
                        disabled={payingBillId === bill.id}
                        onClick={() => handlePayBill(bill)}
                      >
                        {payingBillId === bill.id ? (
                          <Loader2 size={14} className="btn__spinner" />
                        ) : (
                          <Check size={14} />
                        )}
                        Pagar
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => openBillForm(bill)}
                      aria-label={`Editar ${bill.name}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <Button
                      variant="ghost"
                      className="finance-row__del"
                      icon={<Trash2 size={14} />}
                      loading={removingBillId === bill.id}
                      onClick={() => handleRemoveBill(bill)}
                      aria-label={`Excluir ${bill.name}`}
                    />
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="section-label">
        <h2>Orçamentos</h2>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={openBudgetForm}
          disabled={freeBudgetCats.length === 0}
        >
          <Plus size={14} />
          Novo teto
        </button>
      </div>

      {budgetProgress.length === 0 ? (
        <div className="surface finance-empty finance-empty--compact">
          <PieChart size={22} />
          <p>
            Define um teto por categoria (ex.: alimentação R$ 800) e acompanha
            o mês.
          </p>
        </div>
      ) : (
        <div className="finance-budgets">
          {budgetProgress.map((b) => {
            const over = b.spent > b.limit
            const bar = Math.min(100, b.pct)
            return (
              <article
                key={b.id}
                className={`surface finance-budget${over ? ' is-over' : ''}`}
              >
                <div className="finance-budget__head">
                  <span className="finance-budget__icon" aria-hidden>
                    <PieChart size={16} />
                  </span>
                  <div className="finance-budget__info">
                    <strong>{CATEGORY_LABELS[b.category]}</strong>
                    <span>
                      {formatBRL(b.spent)} de {formatBRL(b.limit)}
                      {over
                        ? ` · +${formatBRL(b.spent - b.limit)}`
                        : ` · falta ${formatBRL(b.remaining)}`}
                    </span>
                  </div>
                  <em className={over ? 'is-out' : ''}>{b.pct}%</em>
                  <Button
                    variant="ghost"
                    className="finance-row__del"
                    icon={<Trash2 size={14} />}
                    loading={removingBudgetId === b.id}
                    onClick={() =>
                      handleRemoveBudget(b.id, CATEGORY_LABELS[b.category])
                    }
                    aria-label={`Remover orçamento ${CATEGORY_LABELS[b.category]}`}
                  />
                </div>
                <div
                  className="finance-meter"
                  role="progressbar"
                  aria-valuenow={bar}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span
                    className={`finance-meter__fill${over ? ' is-over' : ''}`}
                    style={{ width: `${bar}%` }}
                  />
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="section-label">
        <h2>Metas</h2>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={openGoalForm}
        >
          <Plus size={14} />
          Nova meta
        </button>
      </div>

      <div className="finance-goals">
        {goals.map((goal) => {
          const pct = Math.min(
            100,
            Math.round((goal.saved / Math.max(1, goal.target)) * 100),
          )
          const remaining = Math.max(0, goal.target - goal.saved)
          return (
            <div key={goal.id} className="surface finance-goal">
              <div className="finance-goal__head">
                <span className="finance-goal__icon">
                  <Target size={16} />
                </span>
                <div className="finance-goal__meta">
                  <strong>{goal.name}</strong>
                  <span>
                    {formatBRL(goal.saved)}
                    <em> de {formatBRL(goal.target)}</em>
                  </span>
                  {(habitsByGoal.get(goal.id)?.length ?? 0) > 0 && (
                    <em className="finance-goal__habits">
                      Hábitos: {habitsByGoal.get(goal.id)!.join(' · ')}
                    </em>
                  )}
                </div>
                <span className="finance-goal__pct">{pct}%</span>
                <Button
                  variant="ghost"
                  className="finance-goal__del"
                  icon={<Trash2 size={14} />}
                  loading={removingGoalId === goal.id}
                  onClick={() => handleRemoveGoal(goal.id, goal.name)}
                  title="Remover meta"
                  aria-label={`Remover meta ${goal.name}`}
                />
              </div>

              <div
                className="finance-meter"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span
                  className="finance-meter__fill"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <p className="finance-goal__remain">
                {remaining > 0
                  ? `Faltam ${formatBRL(remaining)}`
                  : 'Meta alcançada'}
              </p>

              <div className="finance-goal__actions">
                {[50, 100, 250].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="finance-goal__chip"
                    onClick={() => addToGoal(goal.id, n)}
                  >
                    +{n}
                  </button>
                ))}
                <div className="finance-goal__add">
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="Outro"
                    value={goalAdds[goal.id] ?? ''}
                    onChange={(e) =>
                      setGoalAdds((prev) => ({
                        ...prev,
                        [goal.id]: sanitizeMoneyTyping(e.target.value),
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const v = parseBRLInput(goalAdds[goal.id] ?? '')
                        if (!v) return
                        addToGoal(goal.id, v)
                        setGoalAdds((prev) => ({ ...prev, [goal.id]: '' }))
                      }
                    }}
                    aria-label={`Adicionar valor a ${goal.name}`}
                  />
                  <button
                    type="button"
                    className={`finance-goal__add-btn${addingGoalId === goal.id ? ' is-loading' : ''}`}
                    disabled={addingGoalId === goal.id}
                    onClick={() => {
                      const v = parseBRLInput(goalAdds[goal.id] ?? '')
                      if (!v) return
                      addToGoal(goal.id, v)
                      setGoalAdds((prev) => ({ ...prev, [goal.id]: '' }))
                    }}
                    aria-label="Adicionar valor"
                  >
                    {addingGoalId === goal.id ? (
                      <Loader2 size={14} className="btn__spinner" aria-hidden />
                    ) : (
                      <Plus size={14} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

          </>
        }
        panel={
          view === 'budget' ? (
            <form
              className="surface finance-form"
              onSubmit={handleSaveBudget}
            >
              <label className="plan-field">
                <span>Categoria</span>
                <select
                  value={budgetCategory}
                  onChange={(e) =>
                    setBudgetCategory(e.target.value as FinanceCategory)
                  }
                  disabled={savingBudget}
                >
                  {(freeBudgetCats.length > 0
                    ? freeBudgetCats
                    : EXPENSE_CATEGORIES
                  ).map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="plan-field">
                <span>Teto mensal (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={budgetLimit}
                  onChange={(e) =>
                    setBudgetLimit(sanitizeMoneyTyping(e.target.value))
                  }
                  placeholder="Ex.: 800"
                  required
                  disabled={savingBudget}
                  autoFocus
                />
              </label>
              <div className="habit-form__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={closePanel}
                  disabled={savingBudget}
                >
                  Cancelar
                </button>
                <Button
                  type="submit"
                  variant="primary"
                  icon={<PieChart size={16} />}
                  loading={savingBudget}
                  loadingLabel="A guardar…"
                >
                  Guardar teto
                </Button>
              </div>
            </form>
          ) : view === 'bill' ? (
            <form
              className="surface finance-form"
              onSubmit={handleSaveBill}
            >
              {!editingBillId && (
                <div className="habit-ideas" aria-label="Ideias rápidas">
                  {BILL_IDEAS.map((idea) => (
                    <button
                      key={idea.name}
                      type="button"
                      className="habit-idea"
                      onClick={() => applyBillIdea(idea)}
                    >
                      {idea.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="finance-form__grid">
                <label className="plan-field plan-field--grow">
                  <span>Nome</span>
                  <input
                    type="text"
                    value={billName}
                    onChange={(e) => setBillName(e.target.value)}
                    placeholder="Ex.: Netflix"
                    required
                    disabled={savingBill}
                    autoFocus
                  />
                </label>
                <label className="plan-field">
                  <span>Valor (R$)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={billAmount}
                    onChange={(e) =>
                      setBillAmount(sanitizeMoneyTyping(e.target.value))
                    }
                    placeholder="Ex.: 55,90"
                    required
                    disabled={savingBill}
                  />
                </label>
                <label className="plan-field">
                  <span>Dia do mês</span>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={billDay}
                    onChange={(e) => setBillDay(e.target.value)}
                    required
                    disabled={savingBill}
                  />
                </label>
                <label className="plan-field plan-field--grow">
                  <span>Categoria</span>
                  <select
                    value={billCategory}
                    onChange={(e) =>
                      setBillCategory(e.target.value as FinanceCategory)
                    }
                    disabled={savingBill}
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="config-pref__row">
                <div className="config-pref__info">
                  <strong>Ativa</strong>
                  <p>Pausa se quiseres parar os avisos sem apagar.</p>
                </div>
                <button
                  type="button"
                  className={`config-switch${billActive ? ' is-on' : ''}`}
                  role="switch"
                  aria-checked={billActive}
                  onClick={() => setBillActive((v) => !v)}
                >
                  <span className="config-switch__knob" />
                </button>
              </div>
              <div className="habit-form__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={closePanel}
                  disabled={savingBill}
                >
                  Cancelar
                </button>
                <Button
                  type="submit"
                  variant="primary"
                  icon={<Plus size={16} />}
                  loading={savingBill}
                  loadingLabel="A guardar…"
                >
                  {editingBillId ? 'Guardar' : 'Adicionar'}
                </Button>
              </div>
            </form>
          ) : view === 'tx' ? (
            <form className="surface finance-form" onSubmit={handleAddTx}>
              <div className="finance-type-toggle">
                <button
                  type="button"
                  className={`finance-type-toggle__btn${type === 'expense' ? ' is-active is-out' : ''}`}
                  onClick={() => handleTypeChange('expense')}
                >
                  Saída
                </button>
                <button
                  type="button"
                  className={`finance-type-toggle__btn${type === 'income' ? ' is-active is-in' : ''}`}
                  onClick={() => handleTypeChange('income')}
                >
                  Entrada
                </button>
              </div>

              <div className="finance-form__grid">
                <label className="plan-field plan-field--grow">
                  <span>Valor (R$)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    required
                    value={amount}
                    onChange={(e) =>
                      setAmount(sanitizeMoneyTyping(e.target.value))
                    }
                    placeholder="Ex.: 45,90"
                    autoFocus
                  />
                </label>
                <label className="plan-field">
                  <span>Data</span>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => {
                      const next = e.target.value
                      if (/^\d{4}-\d{2}-\d{2}$/.test(next)) setTxDate(next)
                    }}
                    required
                  />
                </label>
                <label className="plan-field plan-field--grow">
                  <span>Categoria</span>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as FinanceCategory)
                    }
                  >
                    {cats.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="plan-field plan-field--grow">
                  <span>Nota (opcional)</span>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ex.: mercado da semana"
                  />
                </label>
              </div>

              <div className="habit-form__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={closePanel}
                  disabled={savingTx}
                >
                  Cancelar
                </button>
                <Button
                  type="submit"
                  variant="primary"
                  icon={<Plus size={16} />}
                  loading={savingTx}
                  loadingLabel="A guardar…"
                >
                  Guardar {type === 'income' ? 'entrada' : 'saída'}
                </Button>
              </div>
            </form>
          ) : (
            <form
              className="surface finance-goal-form"
              onSubmit={handleAddGoal}
            >
              <div className="finance-form__grid">
                <label className="plan-field plan-field--grow">
                  <span>Nome</span>
                  <input
                    type="text"
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    placeholder="Ex.: Viagem"
                    required
                    autoFocus
                  />
                </label>
                <label className="plan-field">
                  <span>Objetivo R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={goalTarget}
                    onChange={(e) =>
                      setGoalTarget(sanitizeMoneyTyping(e.target.value))
                    }
                    placeholder="Ex.: 5.000"
                    required
                  />
                </label>
              </div>
              <div className="habit-form__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={closePanel}
                  disabled={savingGoal}
                >
                  Cancelar
                </button>
                <Button
                  type="submit"
                  variant="primary"
                  icon={<Plus size={16} />}
                  loading={savingGoal}
                  loadingLabel="A criar…"
                >
                  Criar meta
                </Button>
              </div>
            </form>
          )
        }
      />
    </PageTransition>
  )
}
