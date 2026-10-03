import { motion } from 'framer-motion'
import {
  CalendarDays,
  Check,
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
import { MealPlanEditor } from '../components/nutricao/MealPlanEditor'
import {
  PageTransition,
  staggerContainer,
  staggerItem,
} from '../components/ui/PageTransition'
import { PageHeader, PageScreens } from '../components/ui/PageShell'
import { Button } from '../components/ui/Button'
import { ActivityHeatmap } from '../components/ui/ActivityHeatmap'
import { ProgressRing } from '../components/ui/ProgressRing'
import { useConfirm, useToast } from '../components/ui/Feedback'
import {
  MEAL_SLOTS,
  WEEKDAY_LABELS,
  entryMacros,
  filterPantry,
  scaleMacros,
  waterServingSlots,
} from '../data/nutricaoDefaults'
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
import type { FoodItem, MealSlot, Weekday } from '../types/nutricao'

const PORTIONS = [50, 100, 150, 200, 300]

function pct(value: number, goal: number) {
  if (goal <= 0) return 0
  return Math.min(160, Math.round((value / goal) * 100))
}

export function NutricaoPage() {
  const {
    state,
    todayWeekday,
    todayEntries,
    todayMacros,
    todayPlanItems,
    planDoneIds,
    planPending,
    mealPlan,
    water,
    score,
    coach,
    recentFoods,
    addFood,
    removeEntry,
    setWaterServings,
    toggleFavorite,
    setGoals,
    addPlanItem,
    updatePlanItem,
    removePlanItem,
    copyPlanDay,
    copyDiaryToPlanDay,
    togglePlanItemDone,
    adjustPlanEntryGrams,
    createManualFood,
  } = useNutricao()
  const { toast } = useToast()
  const { confirm } = useConfirm()

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTarget, setSearchTarget] = useState<'diary' | 'plan'>('diary')
  const [planDay, setPlanDay] = useState<Weekday>(1)
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
  const [view, setView] = useState<'home' | 'goals' | 'plan'>('home')
  /** null = mostrar valor guardado; string = rascunho (permite apagar) */
  const [bottleDraft, setBottleDraft] = useState<string | null>(null)
  const [goalsBottleDraft, setGoalsBottleDraft] = useState<string | null>(null)
  const onPanel = view !== 'home'

  const bottleDisplay = bottleDraft ?? String(state.waterServingMl)
  const goalsBottleDisplay =
    goalsBottleDraft ?? String(state.waterServingMl)

  function commitBottleDraft(raw: string | null, clearDraft: () => void) {
    clearDraft()
    if (raw === null) return
    const trimmed = raw.trim()
    if (trimmed === '') {
      setGoals({ waterServingMl: 0 })
      return
    }
    const n = Number(trimmed)
    setGoals({
      waterServingMl: Number.isFinite(n) ? n : 0,
    })
  }

  const parsed = useMemo(() => parseFoodQuery(query), [query])
  const pantryHits = useMemo(() => filterPantry(parsed.query), [parsed.query])
  const remoteCount =
    results.taco.length + results.off.length + results.usda.length
  const favoriteIds = useMemo(
    () => new Set(state.favorites.map((f) => f.id)),
    [state.favorites],
  )
  const browsing = parsed.query.length < 2

  const planDoneCount = todayPlanItems.length - planPending

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
      void searchTaco(q).then((taco) => {
        if (ctrl.signal.aborted) return
        setResults({ taco: rankFoods(taco, q), off: [], usda: [] })
      })
      void searchFoods(q, ctrl.signal)
        .then((items) => {
          if (ctrl.signal.aborted) return
          setResults(items)
          setSearched(true)
        })
        .catch((err: unknown) => {
          if (ctrl.signal.aborted) return
          if (err instanceof DOMException && err.name === 'AbortError') return
          setSearchError(
            'As bases remotas não responderam. Usa a TACO ou a despensa.',
          )
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

  function openSearch(slot: MealSlot, target: 'diary' | 'plan' = 'diary') {
    setSearchTarget(target)
    setMeal(slot)
    setPicked(null)
    setGrams(100)
    setQuery('')
    setResults({ taco: [], off: [], usda: [] })
    setSearchOpen(true)
  }

  function openPlanSearch(day: Weekday, slot: MealSlot) {
    setPlanDay(day)
    openSearch(slot, 'plan')
  }

  function handleAdd() {
    if (!picked) return
    if (searchTarget === 'plan') {
      addPlanItem(planDay, meal, picked, grams)
      toast(
        `${picked.name} · ${grams}g no plano (${WEEKDAY_LABELS[planDay]})`,
        'ok',
      )
    } else {
      addFood(meal, picked, grams)
      const brand = productBrand(picked) ? `${productBrand(picked)} · ` : ''
      toast(
        `${brand}${picked.name} · ${grams}g no ${MEAL_SLOTS.find((s) => s.id === meal)?.label}`,
        'ok',
      )
    }
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

  const headerTitle =
    view === 'goals'
      ? 'Metas nutricionais'
      : view === 'plan'
        ? 'Plano alimentar'
        : 'Nutrição'
  const headerSub =
    view === 'goals'
      ? 'Ajusta calorias e macros do dia.'
      : view === 'plan'
        ? 'Monta Seg–Dom por refeição. No dia, marca o que comeste.'
        : 'Plano da semana + extras do dia.'

  return (
    <PageTransition>
      <div className="nutri-page">
        <PageHeader
          kicker="Prato"
          title={headerTitle}
          sub={headerSub}
          onBack={onPanel ? () => setView('home') : undefined}
          action={
            <div className="nutri-header-actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setView('plan')}
              >
                <CalendarDays size={16} />
                Plano
              </button>
              <Button
                variant="primary"
                icon={<Plus size={16} />}
                onClick={() => openSearch('almoco')}
              >
                Comer
              </Button>
            </div>
          }
        />

        <PageScreens
          mode={view}
          home={
            <div className="nutri-home">
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
                  onClick={() => setView('goals')}
                >
                  Ajustar metas
                </button>
              </section>

              <section className="surface nutri-water">
                <div className="nutri-water__head">
                  <Droplets size={16} />
                  <strong>Água</strong>
                  <span>
                    {water} / {state.waterGoal} ml
                  </span>
                </div>
                <p className="nutri-water__hint">
                  Cada marca = {state.waterServingMl} ml (tua garrafa).
                </p>
                <div
                  className="nutri-water__glasses"
                  role="group"
                  aria-label="Garrafas de água"
                >
                  {Array.from(
                    {
                      length: waterServingSlots(
                        state.waterGoal,
                        state.waterServingMl,
                      ),
                    },
                    (_, i) => {
                      const n = i + 1
                      const filledMl = n * state.waterServingMl
                      const filled = water >= filledMl
                      const currentServings = Math.round(
                        water / Math.max(1, state.waterServingMl),
                      )
                      return (
                        <button
                          key={n}
                          type="button"
                          className={`nutri-bottle${filled ? ' is-filled' : ''}`}
                          aria-pressed={filled}
                          aria-label={`${state.waterServingMl} ml · garrafa ${n}`}
                          onClick={() =>
                            setWaterServings(
                              currentServings === n ? n - 1 : n,
                            )
                          }
                        >
                          <span className="nutri-bottle__body" />
                          <em>{state.waterServingMl}</em>
                        </button>
                      )
                    },
                  )}
                </div>
                <label className="nutri-water__serving">
                  <span>Garrafa (ml)</span>
                  <input
                    type="number"
                    min={0}
                    max={2000}
                    step={50}
                    inputMode="numeric"
                    value={bottleDisplay}
                    onChange={(e) => setBottleDraft(e.target.value)}
                    onBlur={() =>
                      commitBottleDraft(bottleDraft, () => setBottleDraft(null))
                    }
                  />
                </label>
              </section>

              <section className="surface nutri-today-plan">
                <div className="nutri-today-plan__head">
                  <div>
                    <p className="page-kicker">
                      {WEEKDAY_LABELS[todayWeekday]}
                    </p>
                    <h2>Plano de hoje</h2>
                  </div>
                  <span>
                    {todayPlanItems.length === 0
                      ? 'Vazio'
                      : `${planDoneCount}/${todayPlanItems.length}`}
                  </span>
                </div>

                {todayPlanItems.length === 0 ? (
                  <div className="nutri-today-plan__empty">
                    <p>
                      Ainda sem plano para {WEEKDAY_LABELS[todayWeekday]}.
                      Monta a semana ou regista um extra abaixo.
                    </p>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => setView('plan')}
                    >
                      <CalendarDays size={14} />
                      Montar plano
                    </button>
                  </div>
                ) : (
                  <ul className="nutri-today-plan__list">
                    {todayPlanItems.map((item) => {
                      const done = planDoneIds.has(item.id)
                      const entry = todayEntries.find(
                        (e) => e.planItemId === item.id,
                      )
                      const gramsNow = entry?.grams ?? item.grams
                      const m = scaleMacros(item.food.per100, gramsNow)
                      return (
                        <li
                          key={item.id}
                          className={done ? 'is-done' : undefined}
                        >
                          <button
                            type="button"
                            className={`nutri-today-plan__check${done ? ' is-done' : ''}`}
                            aria-pressed={done}
                            aria-label={
                              done
                                ? `Desmarcar ${item.food.name}`
                                : `Marcar ${item.food.name}`
                            }
                            onClick={() => {
                              togglePlanItemDone(item)
                              toast(
                                done
                                  ? 'Removido do diário'
                                  : `${item.food.name} marcado`,
                                done ? 'info' : 'ok',
                              )
                            }}
                          >
                            {done ? <Check size={14} strokeWidth={3} /> : null}
                          </button>
                          <div className="nutri-today-plan__info">
                            <strong>{item.food.name}</strong>
                            <span>
                              {MEAL_SLOTS.find((s) => s.id === item.meal)?.label}
                              {' · '}
                              {m.kcal} kcal · P {m.protein}
                            </span>
                          </div>
                          {done ? (
                            <label className="nutri-today-plan__grams">
                              <input
                                type="number"
                                min={1}
                                value={gramsNow}
                                onChange={(e) =>
                                  adjustPlanEntryGrams(
                                    item.id,
                                    Number(e.target.value) || 1,
                                  )
                                }
                                aria-label="Gramas"
                              />
                              <span>g</span>
                            </label>
                          ) : (
                            <em>{item.grams}g</em>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              <div className="section-label">
                <h2>Refeições</h2>
                <span>Extras e marcados</span>
              </div>

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
                        <p className="nutri-meal__empty">
                          Nada ainda nesta refeição.
                        </p>
                      ) : (
                        <ul>
                          {items.map((entry) => {
                            const macrosItem = entryMacros(entry)
                            return (
                              <li key={entry.id}>
                                <div>
                                  <strong>
                                    {entry.food.name}
                                    {entry.planItemId ? (
                                      <span className="nutri-from-plan">
                                        plano
                                      </span>
                                    ) : null}
                                  </strong>
                                  {productBrand(entry.food) ? (
                                    <em className="nutri-food__brand">
                                      {productBrand(entry.food)}
                                    </em>
                                  ) : null}
                                  <span>
                                    {entry.grams} g · {macrosItem.kcal} kcal ·{' '}
                                    {macrosItem.protein} g prot
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="icon-btn"
                                  aria-label={`Remover ${entry.food.name}`}
                                  onClick={() =>
                                    handleRemove(entry.id, entry.food.name)
                                  }
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
            </div>
          }
          panel={
            view === 'plan' ? (
              <MealPlanEditor
                days={mealPlan.days}
                kcalGoal={state.kcalGoal}
                proteinGoal={state.proteinGoal}
                carbsGoal={state.carbsGoal}
                fatGoal={state.fatGoal}
                initialDay={todayWeekday === 0 ? 0 : todayWeekday}
                onAddFromDb={openPlanSearch}
                onAddCustom={(day, mealSlot, food, g) => {
                  addPlanItem(day, mealSlot, food, g)
                  toast(`${food.name} no plano`, 'ok')
                }}
                onUpdateItem={updatePlanItem}
                onRemoveItem={(day, id) => {
                  removePlanItem(day, id)
                  toast('Item removido do plano', 'info')
                }}
                onCopyDay={(from, to) => {
                  copyPlanDay(from, to)
                  toast(
                    to === 'weekdays'
                      ? 'Copiado para dias úteis'
                      : 'Dia copiado',
                    'ok',
                  )
                }}
                onCopyYesterday={(day) => {
                  const ok = copyDiaryToPlanDay(day)
                  toast(
                    ok
                      ? 'Diário de ontem aplicado a este dia'
                      : 'Ontem sem registos no diário',
                    ok ? 'ok' : 'warn',
                  )
                }}
                createManualFood={createManualFood}
              />
            ) : (
              <form
                className="surface nutri-goals-panel"
                onSubmit={(e) => {
                  e.preventDefault()
                  setView('home')
                  toast('Metas atualizadas', 'ok')
                }}
              >
                <div className="nutri-goals">
                  <label>
                    <span>kcal</span>
                    <input
                      type="number"
                      min={800}
                      value={state.kcalGoal}
                      onChange={(e) =>
                        setGoals({ kcalGoal: Number(e.target.value) })
                      }
                      autoFocus
                    />
                  </label>
                  <label>
                    <span>Proteína</span>
                    <input
                      type="number"
                      min={20}
                      value={state.proteinGoal}
                      onChange={(e) =>
                        setGoals({ proteinGoal: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    <span>Carbo</span>
                    <input
                      type="number"
                      min={20}
                      value={state.carbsGoal}
                      onChange={(e) =>
                        setGoals({ carbsGoal: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    <span>Gordura</span>
                    <input
                      type="number"
                      min={15}
                      value={state.fatGoal}
                      onChange={(e) =>
                        setGoals({ fatGoal: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    <span>Água (ml/dia)</span>
                    <input
                      type="number"
                      min={200}
                      max={8000}
                      step={100}
                      value={state.waterGoal}
                      onChange={(e) =>
                        setGoals({ waterGoal: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    <span>Garrafa (ml)</span>
                    <input
                      type="number"
                      min={0}
                      max={2000}
                      step={50}
                      inputMode="numeric"
                      value={goalsBottleDisplay}
                      onChange={(e) => setGoalsBottleDraft(e.target.value)}
                      onBlur={() =>
                        commitBottleDraft(goalsBottleDraft, () =>
                          setGoalsBottleDraft(null),
                        )
                      }
                    />
                  </label>
                </div>
                <div className="habit-form__actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setView('home')}
                  >
                    Cancelar
                  </button>
                  <Button type="submit" variant="primary">
                    Guardar metas
                  </Button>
                </div>
              </form>
            )
          }
        />

        {searchOpen &&
          createPortal(
            <div className="nutri-overlay" role="presentation">
              <button
                type="button"
                className="nutri-overlay__backdrop"
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
                      <p className="page-kicker">
                        {searchTarget === 'plan'
                          ? `Plano · ${WEEKDAY_LABELS[planDay]}`
                          : 'Adicionar'}
                      </p>
                      <h2>
                        {searchTarget === 'plan'
                          ? 'O que entra no plano?'
                          : 'O que vais comer?'}
                      </h2>
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
                      {searchError && (
                        <p className="nutri-off__err">{searchError}</p>
                      )}
                      {searched &&
                        !searching &&
                        remoteCount === 0 &&
                        !searchError && (
                          <p>
                            Nada nas bases com esse nome. Tenta outro termo.
                          </p>
                        )}
                      <FoodGroup
                        title={
                          results.taco.length
                            ? `TACO · ${results.taco.length}`
                            : ''
                        }
                        items={results.taco}
                        favoriteIds={favoriteIds}
                        selectedId={picked?.id}
                        onPick={setPicked}
                        onStar={toggleFavorite}
                      />
                      <FoodGroup
                        title={
                          results.off.length
                            ? `Marcas · ${results.off.length}`
                            : ''
                        }
                        items={results.off}
                        favoriteIds={favoriteIds}
                        selectedId={picked?.id}
                        onPick={setPicked}
                        onStar={toggleFavorite}
                      />
                      <FoodGroup
                        title={
                          results.usda.length
                            ? `USDA · ${results.usda.length}`
                            : ''
                        }
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
                        <em className="nutri-food__brand">
                          {productBrand(picked)}
                        </em>
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
                          onChange={(e) =>
                            setGrams(Number(e.target.value) || 1)
                          }
                          aria-label="Gramas"
                        />
                        <span>g</span>
                      </label>
                    </div>
                    <Button
                      variant="primary"
                      icon={<UtensilsCrossed size={16} />}
                      onClick={handleAdd}
                    >
                      {searchTarget === 'plan'
                        ? 'Meter no plano'
                        : 'Meter no prato'}
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
              aria-label={
                favoriteIds.has(item.id)
                  ? 'Tirar dos favoritos'
                  : 'Favoritar'
              }
              onClick={() => onStar(item)}
            >
              <Star
                size={15}
                fill={favoriteIds.has(item.id) ? 'currentColor' : 'none'}
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
