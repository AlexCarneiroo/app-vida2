import { motion } from 'framer-motion'
import {
  Droplets,
  Plus,
  Search,
  Star,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  PageTransition,
  staggerContainer,
  staggerItem,
} from '../components/ui/PageTransition'
import { Button } from '../components/ui/Button'
import { ActivityHeatmap } from '../components/ui/ActivityHeatmap'
import { ProgressRing } from '../components/ui/ProgressRing'
import { useConfirm, useToast } from '../components/ui/Feedback'
import { MEAL_SLOTS, entryMacros, filterPantry, scaleMacros } from '../data/nutricaoDefaults'
import { useNutricao } from '../hooks/useNutricao'
import {
  foodHint,
  parseFoodQuery,
  productBrand,
  rankFoods,
  searchFoods,
  searchTaco,
  type FoodSearchResult,
} from '../lib/openFoodFacts'
import type { FoodItem, MealSlot } from '../types/nutricao'

const PORTIONS = [50, 100, 150, 200, 300]

function pct(value: number, goal: number) {
  if (goal <= 0) return 0
  return Math.min(160, Math.round((value / goal) * 100))
}

export function NutricaoPage() {
  const {
    state,
    todayEntries,
    todayMacros,
    water,
    score,
    coach,
    recentFoods,
    addFood,
    removeEntry,
    setWater,
    toggleFavorite,
    setGoals,
  } = useNutricao()
  const { toast } = useToast()
  const { confirm } = useConfirm()

  const [searchOpen, setSearchOpen] = useState(false)
  const [meal, setMeal] = useState<MealSlot>('almoco')
  const [query, setQuery] = useState('')
  const [grams, setGrams] = useState(100)
  const [picked, setPicked] = useState<FoodItem | null>(null)
  const [results, setResults] = useState<FoodSearchResult>({
    taco: [],
    off: [],
    usda: [],
  })
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [showGoals, setShowGoals] = useState(false)

  const parsed = useMemo(() => parseFoodQuery(query), [query])
  const pantryHits = useMemo(() => filterPantry(parsed.query), [parsed.query])
  const remoteCount = results.taco.length + results.off.length + results.usda.length
  const favoriteIds = useMemo(
    () => new Set(state.favorites.map((f) => f.id)),
    [state.favorites],
  )
  const browsing = parsed.query.length < 2

  useEffect(() => {
    if (!searchOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [searchOpen])

  useEffect(() => {
    if (parsed.grams) setGrams(parsed.grams)
  }, [parsed.grams])

  useEffect(() => {
    const q = parsed.query
    if (q.length < 2) {
      setResults({ taco: [], off: [], usda: [] })
      setSearching(false)
      setSearched(false)
      setSearchError('')
      return
    }
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => {
      setSearching(true)
      setSearchError('')
      setResults({ taco: rankFoods(searchTaco(q), q), off: [], usda: [] })
      void searchFoods(q, ctrl.signal)
        .then((items) => {
          if (ctrl.signal.aborted) return
          setResults(items)
          setSearched(true)
        })
        .catch((err: unknown) => {
          if (ctrl.signal.aborted) return
          if (err instanceof DOMException && err.name === 'AbortError') return
          setSearchError('As bases remotas não responderam. Usa a TACO ou a despensa.')
          setSearched(true)
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setSearching(false)
        })
    }, 380)
    return () => {
      ctrl.abort()
      window.clearTimeout(timer)
    }
  }, [parsed.query])

  function openSearch(slot: MealSlot) {
    setMeal(slot)
    setPicked(null)
    setGrams(100)
    setQuery('')
    setResults({ taco: [], off: [], usda: [] })
    setSearchOpen(true)
  }

  function handleAdd() {
    if (!picked) return
    addFood(meal, picked, grams)
    const brand = productBrand(picked) ? `${productBrand(picked)} · ` : ''
    toast(
      `${brand}${picked.name} · ${grams}g no ${MEAL_SLOTS.find((s) => s.id === meal)?.label}`,
      'ok',
    )
    setSearchOpen(false)
    setPicked(null)
    setQuery('')
  }

  async function handleRemove(id: string, label: string) {
    const ok = await confirm({
      title: 'Tirar do diário?',
      message: `“${label}” some do prato de hoje.`,
      confirmLabel: 'Remover',
    })
    if (!ok) return
    removeEntry(id)
    toast('Item removido', 'info')
  }

  const kcalPct = pct(todayMacros.kcal, state.kcalGoal)
  const preview = picked ? scaleMacros(picked.per100, grams) : null

  return (
    <PageTransition>
      <div className="nutri-page">
      <header className="page-header">
        <div>
          <p className="page-kicker">Prato</p>
          <h1 className="page-title">Nutrição</h1>
          <p className="page-sub">
            Alimento ou marca, e a porção — Barilla 300g.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => openSearch('almoco')}
        >
          Comer
        </Button>
      </header>

      <section className="surface nutri-plate">
        <div className="nutri-plate__hero">
          <div className="nutri-plate__ring">
            <ProgressRing
              value={Math.min(100, kcalPct)}
              color="var(--jade)"
              size={88}
            />
          </div>
          <div className="nutri-plate__copy">
            <p className="nutri-plate__score">Score do prato</p>
            <p className="nutri-plate__kcal-line">
              <strong>{todayMacros.kcal}</strong>
              <span> / {state.kcalGoal} kcal</span>
            </p>
            <p className="nutri-plate__score-n">{score} pts</p>
          </div>
        </div>
        <p className="nutri-plate__coach">{coach}</p>
        <div className="nutri-macros">
          <MacroBar
            label="Prot"
            value={todayMacros.protein}
            goal={state.proteinGoal}
            color="var(--jade)"
          />
          <MacroBar
            label="Carb"
            value={todayMacros.carbs}
            goal={state.carbsGoal}
            color="var(--sand)"
          />
          <MacroBar
            label="Gord"
            value={todayMacros.fat}
            goal={state.fatGoal}
            color="var(--ink-muted)"
          />
        </div>
        <button
          type="button"
          className="nutri-goals-toggle"
          onClick={() => setShowGoals((v) => !v)}
        >
          {showGoals ? 'Fechar metas' : 'Ajustar metas'}
        </button>
        {showGoals && (
          <div className="nutri-goals">
            <label>
              <span>kcal</span>
              <input
                type="number"
                min={800}
                value={state.kcalGoal}
                onChange={(e) => setGoals({ kcalGoal: Number(e.target.value) })}
              />
            </label>
            <label>
              <span>Proteína</span>
              <input
                type="number"
                min={20}
                value={state.proteinGoal}
                onChange={(e) => setGoals({ proteinGoal: Number(e.target.value) })}
              />
            </label>
            <label>
              <span>Carbo</span>
              <input
                type="number"
                min={20}
                value={state.carbsGoal}
                onChange={(e) => setGoals({ carbsGoal: Number(e.target.value) })}
              />
            </label>
            <label>
              <span>Gordura</span>
              <input
                type="number"
                min={15}
                value={state.fatGoal}
                onChange={(e) => setGoals({ fatGoal: Number(e.target.value) })}
              />
            </label>
          </div>
        )}
      </section>

      <section className="surface nutri-water">
        <div className="nutri-water__head">
          <Droplets size={16} />
          <strong>Água</strong>
          <span>
            {water} / {state.waterGoal} copos
          </span>
        </div>
        <div className="nutri-water__glasses" role="group" aria-label="Copos de água">
          {Array.from({ length: state.waterGoal }, (_, i) => {
            const n = i + 1
            const filled = n <= water
            return (
              <button
                key={n}
                type="button"
                className={`nutri-glass${filled ? ' is-filled' : ''}`}
                aria-pressed={filled}
                onClick={() => setWater(water === n ? n - 1 : n)}
              >
                <span />
              </button>
            )
          })}
        </div>
      </section>

      <motion.section
        className="nutri-meals"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {MEAL_SLOTS.map((slot) => {
          const items = todayEntries.filter((e) => e.meal === slot.id)
          const macros = items.reduce(
            (acc, e) => {
              const m = entryMacros(e)
              return {
                kcal: acc.kcal + m.kcal,
                protein: acc.protein + m.protein,
              }
            },
            { kcal: 0, protein: 0 },
          )
          return (
            <motion.article
              key={slot.id}
              className="surface nutri-meal"
              variants={staggerItem}
            >
              <header>
                <div>
                  <p>{slot.hint}</p>
                  <h2>{slot.label}</h2>
                </div>
                <div className="nutri-meal__meta">
                  <span>{macros.kcal} kcal</span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Adicionar no ${slot.label}`}
                    onClick={() => openSearch(slot.id)}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </header>
              {items.length === 0 ? (
                <p className="nutri-meal__empty">Nada ainda nesta refeição.</p>
              ) : (
                <ul>
                  {items.map((entry) => {
                    const macrosItem = entryMacros(entry)
                    return (
                      <li key={entry.id}>
                        <div>
                          <strong>{entry.food.name}</strong>
                          {productBrand(entry.food) ? (
                            <em className="nutri-food__brand">{productBrand(entry.food)}</em>
                          ) : null}
                          <span>
                            {entry.grams} g · {macrosItem.kcal} kcal · {macrosItem.protein} g prot
                          </span>
                        </div>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Remover ${entry.food.name}`}
                          onClick={() => handleRemove(entry.id, entry.food.name)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </motion.article>
          )
        })}
      </motion.section>

      <ActivityHeatmap
        log={state.dayLog}
        range="month"
        title="Calorias do mês"
      />

      {searchOpen &&
        createPortal(
          <div className="app-confirm nutri-overlay">
            <button
              type="button"
              className="app-confirm__backdrop"
              aria-label="Fechar"
              onClick={() => setSearchOpen(false)}
            />
            <div
              className="surface nutri-search"
              role="dialog"
              aria-modal="true"
              aria-label="Adicionar alimento"
            >
              <header className="nutri-search__top">
                <div className="nutri-search__title">
                  <div>
                    <p className="page-kicker">Adicionar</p>
                    <h2>O que vais comer?</h2>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Fechar"
                    onClick={() => setSearchOpen(false)}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="nutri-meal-picks">
                  {MEAL_SLOTS.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      className={meal === slot.id ? 'is-active' : ''}
                      onClick={() => setMeal(slot.id)}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
                <label className="nutri-query">
                  <Search size={16} />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Macarrão Barilla, 300g…"
                  />
                </label>
              </header>

              <div className="nutri-search__body">
                {browsing && (
                  <FoodGroup
                    title="Despensa"
                    items={pantryHits}
                    favoriteIds={favoriteIds}
                    selectedId={picked?.id}
                    onPick={setPicked}
                    onStar={toggleFavorite}
                  />
                )}

                {state.favorites.length > 0 && browsing && (
                  <FoodGroup
                    title="Favoritos"
                    items={state.favorites}
                    favoriteIds={favoriteIds}
                    selectedId={picked?.id}
                    onPick={setPicked}
                    onStar={toggleFavorite}
                  />
                )}

                {recentFoods.length > 0 && browsing && (
                  <FoodGroup
                    title="Recentes"
                    items={recentFoods}
                    favoriteIds={favoriteIds}
                    selectedId={picked?.id}
                    onPick={setPicked}
                    onStar={toggleFavorite}
                  />
                )}

                {!browsing && (
                  <div className="nutri-off">
                    <p>
                      {searching
                        ? 'A procurar alimento e marca…'
                        : remoteCount > 0
                          ? `${remoteCount} resultados`
                          : 'Bases'}
                    </p>
                    {searchError && <p className="nutri-off__err">{searchError}</p>}
                    {searched && !searching && remoteCount === 0 && !searchError && (
                      <p>Nada nas bases com esse nome. Tenta outro termo.</p>
                    )}
                    <FoodGroup
                      title={results.taco.length ? `TACO · ${results.taco.length}` : ''}
                      items={results.taco}
                      favoriteIds={favoriteIds}
                      selectedId={picked?.id}
                      onPick={setPicked}
                      onStar={toggleFavorite}
                    />
                    <FoodGroup
                      title={results.off.length ? `Marcas · ${results.off.length}` : ''}
                      items={results.off}
                      favoriteIds={favoriteIds}
                      selectedId={picked?.id}
                      onPick={setPicked}
                      onStar={toggleFavorite}
                    />
                    <FoodGroup
                      title={results.usda.length ? `USDA · ${results.usda.length}` : ''}
                      items={results.usda}
                      favoriteIds={favoriteIds}
                      selectedId={picked?.id}
                      onPick={setPicked}
                      onStar={toggleFavorite}
                    />
                  </div>
                )}
              </div>

              {picked && (
                <footer className="nutri-search__bar">
                  <div>
                    <strong>{picked.name}</strong>
                    {productBrand(picked) ? (
                      <em className="nutri-food__brand">{productBrand(picked)}</em>
                    ) : null}
                    <span>
                      {preview
                        ? `${preview.kcal} kcal · P ${preview.protein} · C ${preview.carbs} · G ${preview.fat}`
                        : foodHint(picked, grams)}
                    </span>
                  </div>
                  <div className="nutri-portions">
                    {PORTIONS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={grams === n ? 'is-active' : ''}
                        onClick={() => setGrams(n)}
                      >
                        {n}g
                      </button>
                    ))}
                    <label className="nutri-grams">
                      <input
                        type="number"
                        min={1}
                        value={grams}
                        onChange={(e) => setGrams(Number(e.target.value) || 1)}
                        aria-label="Gramas"
                      />
                      <span>g</span>
                    </label>
                  </div>
                  <Button variant="primary" icon={<UtensilsCrossed size={16} />} onClick={handleAdd}>
                    Meter no prato
                  </Button>
                </footer>
              )}
            </div>
          </div>,
          document.body,
        )}
      </div>
    </PageTransition>
  )
}

function MacroBar({
  label,
  value,
  goal,
  color,
}: {
  label: string
  value: number
  goal: number
  color: string
}) {
  const width = Math.min(100, pct(value, goal))
  return (
    <div className="nutri-macro">
      <span>
        {label} {Math.round(value)} / {goal} g
      </span>
      <i>
        <b style={{ width: `${width}%`, background: color }} />
      </i>
    </div>
  )
}

function FoodGroup({
  title,
  items,
  favoriteIds,
  selectedId,
  onPick,
  onStar,
}: {
  title: string
  items: FoodItem[]
  favoriteIds: Set<string>
  selectedId?: string
  onPick: (item: FoodItem) => void
  onStar: (item: FoodItem) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="nutri-group">
      {title ? <p>{title}</p> : null}
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`nutri-food${selectedId === item.id ? ' is-active' : ''}`}
              onClick={() => onPick(item)}
            >
              <strong>{item.name}</strong>
              {productBrand(item) ? (
                <em className="nutri-food__brand">{productBrand(item)}</em>
              ) : null}
              <span>{foodHint(item)}</span>
            </button>
            <button
              type="button"
              className={`icon-btn${favoriteIds.has(item.id) ? ' is-star' : ''}`}
              aria-label={favoriteIds.has(item.id) ? 'Tirar dos favoritos' : 'Favoritar'}
              onClick={() => onStar(item)}
            >
              <Star size={15} fill={favoriteIds.has(item.id) ? 'currentColor' : 'none'} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
