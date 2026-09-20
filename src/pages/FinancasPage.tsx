import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Loader2,
  PiggyBank,
  Plus,
  Target,
  Trash2,
  Wallet,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import {
  ImportBankButton,
  ImportReview,
} from '../components/financas/ImportReview'
import { Button } from '../components/ui/Button'
import {
  PageTransition,
  staggerContainer,
  staggerItem,
} from '../components/ui/PageTransition'
import { useConfirm, useToast } from '../components/ui/Feedback'
import {
  CATEGORY_LABELS,
  categoriesForType,
} from '../data/financasDefaults'
import { useBusyAction } from '../hooks/useBusyAction'
import { useFinancas } from '../hooks/useFinancas'
import { useHabitos } from '../hooks/useHabitos'
import type { ImportDraft } from '../lib/bankImport'
import {
  dateKey,
  formatBRL,
  formatDateBR,
  parseBRLInput,
  sanitizeMoneyTyping,
} from '../lib/date'
import { exportMonthPdf } from '../lib/financeExport'
import type { FinanceCategory, TxType } from '../types/financas'

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
  const { busy: exporting, run: runExport } = useBusyAction()
  const [removingTxId, setRemovingTxId] = useState<string | null>(null)
  const [removingGoalId, setRemovingGoalId] = useState<string | null>(null)
  const [addingGoalId, setAddingGoalId] = useState<string | null>(null)
  const {
    state,
    monthKey,
    monthLabel,
    monthTransactions,
    stats,
    addTransaction,
    removeTransaction,
    importTransactions,
    addGoal,
    updateGoalSaved,
    removeGoal,
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
  const [showForm, setShowForm] = useState(false)
  const [importSession, setImportSession] = useState<ImportSession | null>(null)

  const cats = useMemo(() => categoriesForType(type), [type])

  function handleTypeChange(next: TxType) {
    setType(next)
    setCategory(categoriesForType(next)[0])
  }

  function openOrCloseForm() {
    setShowForm((open) => {
      if (!open) {
        setTxDate(defaultTxDateForMonth(monthKey))
        setAmount('')
        setNote('')
      }
      return !open
    })
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
      setShowForm(false)
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
      toast('Meta criada', 'ok')
    })
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
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <header className="page-header">
        <div>
          <p className="page-kicker">Dinheiro</p>
          <h1 className="page-title">Finanças</h1>
          <p className="page-sub">
            Importa CSV, OFX, TXT ou PDF do banco, confere e guarda. Também
            exporta o mês em PDF.
          </p>
        </div>
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
              void runExport(() => {
                exportMonthPdf({
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
            onClick={openOrCloseForm}
            disabled={savingTx}
          >
            {showForm ? 'Fechar' : 'Adicionar'}
          </Button>
        </div>
      </header>

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

      <AnimatePresence>
        {showForm && (
          <motion.form
            className="surface finance-form"
            onSubmit={handleAddTx}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
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
                  onChange={(e) => setAmount(sanitizeMoneyTyping(e.target.value))}
                  placeholder="Ex.: 45,90"
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

            <Button
              type="submit"
              variant="primary"
              icon={<Plus size={16} />}
              loading={savingTx}
              loadingLabel="A guardar…"
            >
              Guardar {type === 'income' ? 'entrada' : 'saída'}
            </Button>
          </motion.form>
        )}
      </AnimatePresence>

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
        <h2>Metas</h2>
        <span>{goals.length}</span>
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

      <form className="surface finance-goal-form" onSubmit={handleAddGoal}>
        <p className="page-kicker">Nova meta</p>
        <div className="finance-form__grid">
          <label className="plan-field plan-field--grow">
            <span>Nome</span>
            <input
              type="text"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder="Ex.: Viagem"
              required
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
        <Button
          type="submit"
          variant="primary"
          icon={<Plus size={16} />}
          loading={savingGoal}
          loadingLabel="A criar…"
        >
          Criar meta
        </Button>
      </form>
    </PageTransition>
  )
}
