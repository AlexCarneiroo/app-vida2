import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, FileUp, Loader2, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  CATEGORY_LABELS,
  categoriesForType,
} from '../../data/financasDefaults'
import {
  applyMonthToDrafts,
  formatMonthLabel,
  monthOptions,
  parseBankFile,
  type ImportDraft,
} from '../../lib/bankImport'
import { formatBRL, parseBRLInput, sanitizeMoneyTyping } from '../../lib/date'
import { useBusyAction } from '../../hooks/useBusyAction'
import { Button } from '../ui/Button'
import { useConfirm, useToast } from '../ui/Feedback'
import type { FinanceCategory, TxType } from '../../types/financas'

type ImportReviewProps = {
  drafts: ImportDraft[]
  detectedMonth: string | null
  warnings: string[]
  source: string
  onCancel: () => void
  onSave: (
    items: Array<{
      type: TxType
      amount: number
      category: FinanceCategory
      note: string
      dateKey: string
    }>,
  ) => void
}

function formatDay(dateKey: string) {
  const [y, m, d] = dateKey.split('-')
  if (!y || !m || !d) return dateKey
  return `${d}/${m}`
}

export function ImportReview({
  drafts: initial,
  detectedMonth,
  warnings,
  source,
  onCancel,
  onSave,
}: ImportReviewProps) {
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const { busy: saving, run: runSave } = useBusyAction()
  const [rows, setRows] = useState(initial)
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        initial.map((d) => [
          d.id,
          d.amount > 0 ? String(d.amount).replace('.', ',') : '',
        ]),
      ),
  )
  const [targetMonth, setTargetMonth] = useState(
    detectedMonth ?? monthOptions()[0],
  )
  const [remapMonth, setRemapMonth] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  const months = useMemo(() => monthOptions(), [])
  const selectedCount = rows.filter((r) => r.selected).length
  const totalIn = rows
    .filter((r) => r.selected && r.type === 'income')
    .reduce((a, r) => a + r.amount, 0)
  const totalOut = rows
    .filter((r) => r.selected && r.type === 'expense')
    .reduce((a, r) => a + r.amount, 0)

  function updateRow(id: string, patch: Partial<ImportDraft>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const next = { ...r, ...patch }
        if (patch.type && patch.type !== r.type) {
          const cats = categoriesForType(patch.type)
          if (!cats.includes(next.category)) next.category = cats[0]
        }
        return next
      }),
    )
  }

  function updateAmountInput(id: string, raw: string) {
    const typed = sanitizeMoneyTyping(raw)
    setAmountDrafts((prev) => ({ ...prev, [id]: typed }))
    const parsed = parseBRLInput(typed)
    updateRow(id, { amount: parsed ?? 0 })
  }

  async function removeRow(id: string) {
    const ok = await confirm({
      title: 'Remover este movimento?',
      message: 'Ele sai da lista de importação.',
      confirmLabel: 'Remover',
    })
    if (!ok) return
    setRows((prev) => prev.filter((r) => r.id !== id))
    setAmountDrafts((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    if (openId === id) setOpenId(null)
    toast('Movimento removido da revisão', 'info')
  }

  function handleSave() {
    void runSave(() => {
      let ready = rows.filter((r) => r.selected && r.amount > 0)
      if (remapMonth) ready = applyMonthToDrafts(ready, targetMonth)
      onSave(
        ready.map(({ type, amount, category, note, dateKey }) => ({
          type,
          amount,
          category,
          note,
          dateKey,
        })),
      )
    })
  }

  return (
    <motion.div
      className="import-review"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="import-review__top">
        <button
          type="button"
          className="import-review__icon-btn"
          onClick={onCancel}
          aria-label="Fechar"
        >
          <X size={18} />
        </button>
        <div className="import-review__titles">
          <h1>Revisão</h1>
          <p>
            {selectedCount} movimentos · {source.toUpperCase()}
          </p>
        </div>
        <Button
          variant="primary"
          className="import-review__save"
          icon={<Check size={16} />}
          disabled={selectedCount === 0}
          loading={saving}
          loadingLabel="A guardar…"
          onClick={handleSave}
        >
          Guardar
        </Button>
      </header>

      <div className="import-review__summary">
        <span className="is-in">+{formatBRL(totalIn)}</span>
        <span className="is-out">−{formatBRL(totalOut)}</span>
      </div>

      <div className="import-review__monthbar">
        <label>
          <span>Mês</span>
          <select
            value={targetMonth}
            onChange={(e) => setTargetMonth(e.target.value)}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`import-review__remap${remapMonth ? ' is-on' : ''}`}
          onClick={() => setRemapMonth((v) => !v)}
        >
          {remapMonth ? 'Datas → este mês' : 'Manter datas do ficheiro'}
        </button>
      </div>

      {warnings[0] && <p className="import-review__hint">{warnings[0]}</p>}

      <ul className="import-list">
        {rows.map((row) => {
          const open = openId === row.id
          return (
            <li
              key={row.id}
              className={`import-item${row.selected ? '' : ' is-off'}${open ? ' is-open' : ''}`}
            >
              <button
                type="button"
                className="import-item__main"
                onClick={() => setOpenId(open ? null : row.id)}
              >
                <span
                  className={`import-item__dot${row.type === 'income' ? ' is-in' : ' is-out'}`}
                  aria-hidden
                />
                <span className="import-item__body">
                  <strong>{row.note || 'Sem descrição'}</strong>
                  <span>
                    {formatDay(row.dateKey)} ·{' '}
                    {row.type === 'income' ? 'Entrada' : 'Saída'} ·{' '}
                    {CATEGORY_LABELS[row.category]}
                  </span>
                </span>
                <em className={row.type === 'income' ? 'is-in' : 'is-out'}>
                  {row.type === 'income' ? '+' : '−'}
                  {formatBRL(row.amount)}
                </em>
                <ChevronDown
                  size={16}
                  className={`import-item__chevron${open ? ' is-open' : ''}`}
                />
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    className="import-item__edit"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="import-item__edit-inner">
                      <div className="import-item__type">
                        <button
                          type="button"
                          className={row.type === 'expense' ? 'is-active' : ''}
                          onClick={() => updateRow(row.id, { type: 'expense' })}
                        >
                          Saída
                        </button>
                        <button
                          type="button"
                          className={row.type === 'income' ? 'is-active' : ''}
                          onClick={() => updateRow(row.id, { type: 'income' })}
                        >
                          Entrada
                        </button>
                      </div>

                      <div className="import-item__grid">
                        <label>
                          <span>Valor</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            value={amountDrafts[row.id] ?? ''}
                            onChange={(e) =>
                              updateAmountInput(row.id, e.target.value)
                            }
                          />
                        </label>
                        <label>
                          <span>Data</span>
                          <input
                            type="date"
                            value={row.dateKey}
                            onChange={(e) =>
                              updateRow(row.id, { dateKey: e.target.value })
                            }
                          />
                        </label>
                        <label className="is-wide">
                          <span>Categoria</span>
                          <select
                            value={row.category}
                            onChange={(e) =>
                              updateRow(row.id, {
                                category: e.target.value as FinanceCategory,
                              })
                            }
                          >
                            {categoriesForType(row.type).map((c) => (
                              <option key={c} value={c}>
                                {CATEGORY_LABELS[c]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="is-wide">
                          <span>Descrição</span>
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) =>
                              updateRow(row.id, { note: e.target.value })
                            }
                          />
                        </label>
                      </div>

                      <div className="import-item__ops">
                        <button
                          type="button"
                          className="import-item__ghost"
                          onClick={() =>
                            updateRow(row.id, { selected: !row.selected })
                          }
                        >
                          {row.selected ? 'Ignorar' : 'Incluir'}
                        </button>
                        <button
                          type="button"
                          className="import-item__ghost is-danger"
                          onClick={() => removeRow(row.id)}
                        >
                          <Trash2 size={14} />
                          Apagar
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ul>
    </motion.div>
  )
}

type ImportButtonProps = {
  onParsed: (result: {
    drafts: ImportDraft[]
    detectedMonth: string | null
    warnings: string[]
    source: string
  }) => void
  onError: (message: string) => void
}

export function ImportBankButton({ onParsed, onError }: ImportButtonProps) {
  const [busy, setBusy] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pwd, setPwd] = useState('')
  const [pwdHint, setPwdHint] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  async function tryParse(file: File, password?: string) {
    setBusy(true)
    try {
      const result = await parseBankFile(file, { password })
      setPwdOpen(false)
      setPendingFile(null)
      setPwd('')
      if (result.drafts.length === 0) {
        onError(result.warnings[0] || 'Não foi possível ler o ficheiro.')
        return
      }
      onParsed(result)
    } catch (err) {
      if (
        err instanceof Error &&
        err.name === 'PdfPasswordError' &&
        'reason' in err
      ) {
        const reason = (err as { reason: 'need' | 'incorrect' }).reason
        setPendingFile(file)
        setPwdOpen(true)
        setPwdHint(
          reason === 'incorrect'
            ? 'Senha incorreta. Em muitos bancos a senha é o CPF (só números).'
            : 'Este PDF está protegido. Digite a senha — em geral o CPF (só números).',
        )
        setPwd('')
        return
      }
      onError('Falha ao ler o ficheiro do banco.')
    } finally {
      setBusy(false)
    }
  }

  async function onFile(file: File | null) {
    if (!file) return
    await tryParse(file)
  }

  function closePwd() {
    setPwdOpen(false)
    setPendingFile(null)
    setPwd('')
  }

  return (
    <>
      <label
        className={`btn btn--ghost import-bank-btn${busy ? ' is-busy is-loading' : ''}`}
      >
        {busy ? (
          <Loader2 size={16} className="btn__spinner" aria-hidden />
        ) : (
          <FileUp size={16} />
        )}
        {busy ? 'A ler…' : 'Importar extrato'}
        <input
          type="file"
          accept=".csv,.txt,.ofx,.qfx,.pdf,text/csv,text/plain,application/pdf,application/x-ofx,application/ofx"
          hidden
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            e.target.value = ''
            void onFile(f)
          }}
        />
      </label>

      {pwdOpen && pendingFile && (
        <div className="app-confirm">
          <button
            type="button"
            className="app-confirm__backdrop"
            aria-label="Fechar"
            onClick={closePwd}
          />
          <div
            className="surface app-confirm__card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdf-pwd-title"
          >
            <h2 id="pdf-pwd-title">Senha do PDF</h2>
            <p>{pwdHint}</p>
            <label className="import-pwd-field">
              <span>Senha</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                value={pwd}
                placeholder="Ex.: CPF sem pontos"
                onChange={(e) => setPwd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && pwd.trim() && !busy) {
                    void tryParse(pendingFile, pwd.trim())
                  }
                }}
              />
            </label>
            <div className="app-confirm__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={closePwd}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!pwd.trim() || busy}
                onClick={() => void tryParse(pendingFile, pwd.trim())}
              >
                {busy ? 'A abrir…' : 'Abrir PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
