import {
  Check,
  Plus,
  RefreshCw,
  ShoppingCart,
  Trash2,
  Wallet,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { useConfirm, useToast } from '../components/ui/Feedback'
import { PageHeader } from '../components/ui/PageShell'
import { PageTransition } from '../components/ui/PageTransition'
import {
  SHOPPING_AISLES,
  aisleLabel,
  estimatedListTotal,
  guessShoppingAisle,
} from '../data/comprasDefaults'
import { useCompras } from '../hooks/useCompras'
import { useFinancas } from '../hooks/useFinancas'
import { useNutricao } from '../hooks/useNutricao'
import { dateKey, formatBRL } from '../lib/date'
import type { ShoppingAisle } from '../types/compras'

type TabId = 'falta' | 'lista' | 'historico'

const TABS: { id: TabId; label: string }[] = [
  { id: 'falta', label: 'Falta' },
  { id: 'lista', label: 'Lista' },
  { id: 'historico', label: 'Histórico' },
]

export function ComprasPage() {
  const {
    needed,
    activeList,
    history,
    lastDone,
    pending,
    checked,
    estimatedTotal,
    addNeeded,
    removeNeeded,
    startNewList,
    addItemToActive,
    moveNeededToList,
    toggleItem,
    updateItem,
    removeItem,
    redoFromList,
    completeActiveList,
  } = useCompras()
  const { addTransaction } = useFinancas()
  const { mealPlan, state: nutriState } = useNutricao()
  const { toast } = useToast()
  const { confirm } = useConfirm()

  const [tab, setTab] = useState<TabId>('lista')
  const [neededDraft, setNeededDraft] = useState('')
  const [itemDraft, setItemDraft] = useState('')
  const [selectedNeeded, setSelectedNeeded] = useState<string[]>([])
  const [completeOpen, setCompleteOpen] = useState(false)
  const [totalDraft, setTotalDraft] = useState('')
  const [category, setCategory] = useState<'alimentação' | 'compras'>(
    'alimentação',
  )
  const [returnUnchecked, setReturnUnchecked] = useState(true)

  const suggestions = useMemo(() => {
    const names = new Set<string>()
    const out: string[] = []
    const push = (name: string) => {
      const n = name.trim()
      if (!n) return
      const key = n.toLowerCase()
      if (names.has(key)) return
      names.add(key)
      out.push(n)
    }
    for (const fav of nutriState.favorites ?? []) push(fav.name)
    for (let d = 0; d <= 6; d++) {
      for (const item of mealPlan.days[d as 0 | 1 | 2 | 3 | 4 | 5 | 6] ?? []) {
        push(item.food.name)
      }
    }
    for (const n of needed) push(n.name)
    return out.slice(0, 12)
  }, [mealPlan, nutriState.favorites, needed])

  function handleAddNeeded(e: FormEvent) {
    e.preventDefault()
    if (!neededDraft.trim()) return
    addNeeded(neededDraft)
    setNeededDraft('')
    toast('Guardado em Falta', 'ok')
  }

  function handleAddItem(e: FormEvent) {
    e.preventDefault()
    if (!itemDraft.trim()) return
    const name = itemDraft.trim()
    const aisle = guessShoppingAisle(name)
    addItemToActive({ name })
    setItemDraft('')
    toast(`${name} · ${aisleLabel(aisle)}`, 'ok')
  }

  function openComplete() {
    if (!activeList || activeList.items.length === 0) {
      toast('A lista está vazia', 'info')
      return
    }
    setTotalDraft(
      estimatedTotal > 0 ? String(estimatedTotal) : '',
    )
    setCategory('alimentação')
    setReturnUnchecked(true)
    setCompleteOpen(true)
  }

  function confirmComplete() {
    if (!activeList) return
    const amount = Math.abs(Number(totalDraft.replace(',', '.')) || 0)
    let financeTxId: string | null = null
    if (amount > 0) {
      financeTxId =
        addTransaction({
          type: 'expense',
          amount,
          category,
          note: `Compras · ${activeList.title}`,
          dateKey: dateKey(),
        }) ?? null
    }
    completeActiveList({
      totalSpent: amount,
      financeTxId,
      financeCategory: amount > 0 ? category : undefined,
      returnUncheckedToNeeded: returnUnchecked,
    })
    setCompleteOpen(false)
    setTab('historico')
    toast(
      amount > 0
        ? `Compras concluídas · ${formatBRL(amount)}`
        : 'Compras concluídas',
      'ok',
    )
  }

  async function handleNewList() {
    if (activeList && activeList.items.some((i) => !i.checked)) {
      const ok = await confirm({
        title: 'Nova lista?',
        message:
          'A lista atual passa para o histórico (mesmo com itens por comprar).',
        confirmLabel: 'Nova lista',
      })
      if (!ok) return
    }
    startNewList()
    setTab('lista')
    toast('Nova lista pronta', 'ok')
  }

  function handleRedo(sourceId?: string) {
    redoFromList(sourceId)
    setTab('lista')
    toast('Lista refeita', 'ok')
  }

  const grouped = useMemo(() => {
    if (!activeList) {
      return [] as {
        aisle: ShoppingAisle
        label: string
        items: NonNullable<typeof activeList>['items']
      }[]
    }
    const list = activeList
    return SHOPPING_AISLES.map((a) => ({
      aisle: a.id,
      label: a.label,
      items: list.items.filter((i) => i.aisle === a.id),
    })).filter((g) => g.items.length > 0)
  }, [activeList])

  return (
    <PageTransition>
      <PageHeader
        kicker="Mercado"
        title="Compras"
        sub="O que falta, a lista ativa e o histórico — com lançamento nas Finanças."
        action={
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => void handleNewList()}
          >
            Nova
          </Button>
        }
      />

      <nav className="config-section-tabs" role="tablist" aria-label="Compras">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'is-active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'falta' && needed.length > 0 ? (
              <em className="compras-tab-count">{needed.length}</em>
            ) : null}
            {t.id === 'lista' && pending > 0 ? (
              <em className="compras-tab-count">{pending}</em>
            ) : null}
          </button>
        ))}
      </nav>

      {tab === 'falta' && (
        <div className="compras-panel">
          <form className="surface compras-add" onSubmit={handleAddNeeded}>
            <input
              value={neededDraft}
              onChange={(e) => setNeededDraft(e.target.value)}
              placeholder="O que falta? Ex.: leite"
              aria-label="Item em falta"
            />
            <Button type="submit" variant="primary" icon={<Plus size={16} />}>
              Guardar
            </Button>
          </form>

          {suggestions.length > 0 && (
            <div className="compras-chips" aria-label="Sugestões">
              {suggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="compras-chip"
                  onClick={() => {
                    addNeeded(name)
                    toast(`“${name}” em Falta`, 'ok')
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {needed.length === 0 ? (
            <p className="compras-empty">
              Nada marcado. Guarda aqui o que não queres esquecer.
            </p>
          ) : (
            <>
              <div className="compras-needed-actions">
                <Button
                  variant="ghost"
                  onClick={() => {
                    moveNeededToList(
                      selectedNeeded.length > 0 ? selectedNeeded : undefined,
                    )
                    setSelectedNeeded([])
                    setTab('lista')
                    toast('Metido na lista', 'ok')
                  }}
                >
                  {selectedNeeded.length > 0
                    ? `Meter ${selectedNeeded.length} na lista`
                    : 'Meter tudo na lista'}
                </Button>
              </div>
              <ul className="compras-list">
                {needed.map((item) => {
                  const on = selectedNeeded.includes(item.id)
                  return (
                    <li key={item.id} className="surface compras-row compras-row--simple">
                      <button
                        type="button"
                        className={`compras-check${on ? ' is-done' : ''}`}
                        aria-pressed={on}
                        aria-label={
                          on ? `Desmarcar ${item.name}` : `Selecionar ${item.name}`
                        }
                        onClick={() =>
                          setSelectedNeeded((prev) =>
                            on
                              ? prev.filter((id) => id !== item.id)
                              : [...prev, item.id],
                          )
                        }
                      >
                        {on && <Check size={16} strokeWidth={3} />}
                      </button>
                      <div className="compras-row__title">
                        <strong>{item.name}</strong>
                        {item.note ? <span>{item.note}</span> : null}
                      </div>
                      <button
                        type="button"
                        className="compras-row__trash"
                        aria-label="Remover"
                        onClick={() => removeNeeded(item.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      )}

      {tab === 'lista' && (
        <div className="compras-panel">
          <div className="surface compras-summary">
            <div>
              <p className="page-kicker">Lista ativa</p>
              <strong>{activeList?.title ?? 'Sem lista'}</strong>
              <span>
                {activeList
                  ? `${checked}/${activeList.items.length} · estimado ${formatBRL(estimatedTotal)}`
                  : 'Cria uma lista ou mete itens de Falta'}
              </span>
            </div>
            <div className="compras-summary__actions">
              <Button
                variant="ghost"
                icon={<RefreshCw size={16} />}
                disabled={!lastDone && !activeList}
                onClick={() => handleRedo()}
              >
                Refazer
              </Button>
              <Button
                variant="primary"
                icon={<Wallet size={16} />}
                disabled={!activeList || activeList.items.length === 0}
                onClick={openComplete}
              >
                Concluir
              </Button>
            </div>
          </div>

          <form className="surface compras-add" onSubmit={handleAddItem}>
            <input
              value={itemDraft}
              onChange={(e) => setItemDraft(e.target.value)}
              placeholder="Adicionar à lista"
              aria-label="Novo item da lista"
            />
            <Button type="submit" variant="primary" icon={<Plus size={16} />}>
              Add
            </Button>
          </form>

          {suggestions.length > 0 && (
            <div className="compras-chips" aria-label="Sugestões rápidas">
              {suggestions.slice(0, 8).map((name) => (
                <button
                  key={name}
                  type="button"
                  className="compras-chip"
                  onClick={() => {
                    addItemToActive({ name })
                    toast(`${name} · ${aisleLabel(guessShoppingAisle(name))}`, 'ok')
                  }}
                >
                  + {name}
                </button>
              ))}
            </div>
          )}

          {!activeList || activeList.items.length === 0 ? (
            <p className="compras-empty">
              Lista vazia. Adiciona itens ou traz o que está em Falta.
            </p>
          ) : (
            grouped.map((group) => (
              <section key={group.aisle} className="compras-aisle">
                <h3>{group.label}</h3>
                <ul className="compras-list">
                  {group.items.map((item) => {
                    const summaryBits = [
                      item.qty != null ? String(item.qty) : null,
                      item.unit || null,
                      item.estimatedPrice != null
                        ? formatBRL(item.estimatedPrice)
                        : null,
                    ].filter(Boolean)
                    return (
                      <li
                        key={item.id}
                        className={`surface compras-row${item.checked ? ' is-checked' : ''}`}
                      >
                        <div className="compras-row__main">
                          <button
                            type="button"
                            className={`compras-check${item.checked ? ' is-done' : ''}`}
                            aria-pressed={item.checked}
                            aria-label={
                              item.checked
                                ? `Desmarcar ${item.name}`
                                : `Marcar ${item.name}`
                            }
                            onClick={() => toggleItem(item.id)}
                          >
                            {item.checked && (
                              <Check size={16} strokeWidth={3} />
                            )}
                          </button>
                          <div className="compras-row__title">
                            <strong>{item.name}</strong>
                            {item.checked && summaryBits.length > 0 ? (
                              <span>{summaryBits.join(' · ')}</span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="compras-row__trash"
                            aria-label="Remover item"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        {!item.checked && (
                          <div className="compras-row__meta">
                            <label className="compras-field">
                              <span>Qtd</span>
                              <input
                                type="number"
                                min={0}
                                step={1}
                                inputMode="decimal"
                                placeholder="—"
                                value={item.qty ?? ''}
                                onChange={(e) =>
                                  updateItem(item.id, {
                                    qty:
                                      e.target.value === ''
                                        ? undefined
                                        : Number(e.target.value),
                                  })
                                }
                              />
                            </label>
                            <label className="compras-field">
                              <span>Preço</span>
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                inputMode="decimal"
                                placeholder="0"
                                value={item.estimatedPrice ?? ''}
                                onChange={(e) =>
                                  updateItem(item.id, {
                                    estimatedPrice:
                                      e.target.value === ''
                                        ? undefined
                                        : Number(e.target.value),
                                  })
                                }
                              />
                            </label>
                            <label className="compras-field compras-field--aisle">
                              <span>Secção</span>
                              <select
                                value={item.aisle}
                                aria-label="Secção"
                                onChange={(e) =>
                                  updateItem(item.id, {
                                    aisle: e.target.value as ShoppingAisle,
                                  })
                                }
                              >
                                {SHOPPING_AISLES.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      )}

      {tab === 'historico' && (
        <div className="compras-panel">
          {history.length === 0 ? (
            <p className="compras-empty">
              Ainda sem listas concluídas. Quando fechares compras, ficam aqui.
            </p>
          ) : (
            <ul className="compras-history">
              {history.map((list) => (
                <li key={list.id} className="surface compras-history__card">
                  <div>
                    <strong>{list.title}</strong>
                    <span>
                      {list.items.length} itens
                      {list.totalSpent
                        ? ` · ${formatBRL(list.totalSpent)}`
                        : ` · est. ${formatBRL(estimatedListTotal(list))}`}
                      {list.financeTxId ? (
                        <>
                          {' · '}
                          <Link to="/financas">nas Finanças</Link>
                        </>
                      ) : (
                        ''
                      )}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    icon={<RefreshCw size={16} />}
                    onClick={() => handleRedo(list.id)}
                  >
                    Usar de novo
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {completeOpen &&
        createPortal(
          <div
            className="compras-modal-backdrop"
            role="presentation"
            onClick={() => setCompleteOpen(false)}
          >
            <div
              className="surface compras-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="compras-complete-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="compras-modal__head">
                <ShoppingCart size={18} />
                <h2 id="compras-complete-title">Concluir compras</h2>
              </div>
              <p>
                Lança o total nas Finanças. Podes ajustar o valor e a categoria.
              </p>
              <label className="compras-modal__field">
                <span>Total gasto (€)</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  inputMode="decimal"
                  value={totalDraft}
                  onChange={(e) => setTotalDraft(e.target.value)}
                  placeholder="0,00"
                />
              </label>
              <label className="compras-modal__field">
                <span>Categoria</span>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as 'alimentação' | 'compras')
                  }
                >
                  <option value="alimentação">Alimentação</option>
                  <option value="compras">Compras</option>
                </select>
              </label>
              <label className="notif-check">
                <input
                  type="checkbox"
                  checked={returnUnchecked}
                  onChange={(e) => setReturnUnchecked(e.target.checked)}
                />
                <span>Itens por comprar voltam para Falta</span>
              </label>
              <div className="habit-form__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setCompleteOpen(false)}
                >
                  Cancelar
                </button>
                <Button type="button" variant="primary" onClick={confirmComplete}>
                  Concluir
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </PageTransition>
  )
}
