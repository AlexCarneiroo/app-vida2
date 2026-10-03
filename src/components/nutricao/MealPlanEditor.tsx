import {
  Check,
  Copy,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import {
  dayPlanMacros,
  MEAL_SLOTS,
  planItemMacros,
  WEEKDAY_LABELS,
  WEEKDAYS,
} from '../../data/nutricaoDefaults'
import { Button } from '../ui/Button'
import type {
  FoodItem,
  FoodMacros,
  MealSlot,
  PlanItem,
  Weekday,
} from '../../types/nutricao'

type MealPlanEditorProps = {
  days: Record<Weekday, PlanItem[]>
  kcalGoal: number
  proteinGoal: number
  carbsGoal: number
  fatGoal: number
  initialDay?: Weekday
  onAddFromDb: (day: Weekday, meal: MealSlot) => void
  onAddCustom: (
    day: Weekday,
    meal: MealSlot,
    food: FoodItem,
    grams: number,
  ) => void
  onUpdateItem: (
    day: Weekday,
    id: string,
    patch: { grams?: number; food?: FoodItem; meal?: MealSlot; note?: string },
  ) => void
  onRemoveItem: (day: Weekday, id: string) => void
  onCopyDay: (from: Weekday, to: Weekday[] | 'weekdays') => void
  onCopyYesterday: (day: Weekday) => void
  createManualFood: (input: {
    name: string
    brand?: string
    per100: FoodMacros
  }) => FoodItem
}

export function MealPlanEditor({
  days,
  kcalGoal,
  proteinGoal,
  carbsGoal,
  fatGoal,
  initialDay = 1,
  onAddFromDb,
  onAddCustom,
  onUpdateItem,
  onRemoveItem,
  onCopyDay,
  onCopyYesterday,
  createManualFood,
}: MealPlanEditorProps) {
  const [day, setDay] = useState<Weekday>(initialDay)
  const [customMeal, setCustomMeal] = useState<MealSlot | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [customName, setCustomName] = useState('')
  const [customBrand, setCustomBrand] = useState('')
  const [customGrams, setCustomGrams] = useState('100')
  const [customKcal, setCustomKcal] = useState('')
  const [customP, setCustomP] = useState('')
  const [customC, setCustomC] = useState('')
  const [customF, setCustomF] = useState('')

  const items = days[day] ?? []
  const macros = useMemo(() => dayPlanMacros(items), [items])

  function resetCustom() {
    setCustomMeal(null)
    setCustomName('')
    setCustomBrand('')
    setCustomGrams('100')
    setCustomKcal('')
    setCustomP('')
    setCustomC('')
    setCustomF('')
  }

  function handleCustomSubmit(e: FormEvent) {
    e.preventDefault()
    if (!customMeal || !customName.trim()) return
    const food = createManualFood({
      name: customName,
      brand: customBrand || undefined,
      per100: {
        kcal: Number(customKcal) || 0,
        protein: Number(customP) || 0,
        carbs: Number(customC) || 0,
        fat: Number(customF) || 0,
      },
    })
    onAddCustom(day, customMeal, food, Number(customGrams) || 100)
    resetCustom()
  }

  return (
    <div className="nutri-plan">
      <div className="nutri-plan__tabs" role="tablist" aria-label="Dia da semana">
        {WEEKDAYS.map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={day === d}
            className={`nutri-plan__tab${day === d ? ' is-active' : ''}`}
            onClick={() => {
              setDay(d)
              resetCustom()
              setEditingId(null)
            }}
          >
            {WEEKDAY_LABELS[d]}
            {(days[d]?.length ?? 0) > 0 ? (
              <em>{days[d].length}</em>
            ) : null}
          </button>
        ))}
      </div>

      <div className="surface nutri-plan__summary">
        <strong>
          {macros.kcal} / {kcalGoal} kcal
        </strong>
        <span>
          P {Math.round(macros.protein)}/{proteinGoal} · C{' '}
          {Math.round(macros.carbs)}/{carbsGoal} · G {Math.round(macros.fat)}/
          {fatGoal}
        </span>
      </div>

      <div className="nutri-plan__tools">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => onCopyDay(day, 'weekdays')}
        >
          <Copy size={14} />
          Copiar p/ dias úteis
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => onCopyYesterday(day)}
        >
          <Copy size={14} />
          Do diário de ontem
        </button>
      </div>

      {MEAL_SLOTS.map((slot) => {
        const slotItems = items.filter((i) => i.meal === slot.id)
        return (
          <section key={slot.id} className="surface nutri-plan__meal">
            <header>
              <div>
                <p>{slot.hint}</p>
                <h2>{slot.label}</h2>
              </div>
              <div className="nutri-plan__meal-actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    resetCustom()
                    setCustomMeal(slot.id)
                  }}
                >
                  Manual
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Adicionar no ${slot.label}`}
                  onClick={() => onAddFromDb(day, slot.id)}
                >
                  <Plus size={16} />
                </button>
              </div>
            </header>

            {customMeal === slot.id && (
              <form
                className="nutri-plan__custom"
                onSubmit={handleCustomSubmit}
              >
                <p className="nutri-plan__custom-lead">
                  Nome e valores por 100 g (ou 100 ml).
                </p>
                <label className="plan-field">
                  <span>Nome</span>
                  <input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Ex.: Suco natural"
                    required
                    autoFocus
                  />
                </label>
                <label className="plan-field">
                  <span>Marca (opcional)</span>
                  <input
                    value={customBrand}
                    onChange={(e) => setCustomBrand(e.target.value)}
                    placeholder="Ex.: Del Valle"
                  />
                </label>
                <div className="nutri-plan__custom-grid">
                  <label className="plan-field">
                    <span>Porção (g/ml)</span>
                    <input
                      type="number"
                      min={1}
                      value={customGrams}
                      onChange={(e) => setCustomGrams(e.target.value)}
                    />
                  </label>
                  <label className="plan-field">
                    <span>kcal/100</span>
                    <input
                      type="number"
                      min={0}
                      value={customKcal}
                      onChange={(e) => setCustomKcal(e.target.value)}
                      required
                    />
                  </label>
                  <label className="plan-field">
                    <span>Prot</span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={customP}
                      onChange={(e) => setCustomP(e.target.value)}
                    />
                  </label>
                  <label className="plan-field">
                    <span>Carb</span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={customC}
                      onChange={(e) => setCustomC(e.target.value)}
                    />
                  </label>
                  <label className="plan-field">
                    <span>Gord</span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={customF}
                      onChange={(e) => setCustomF(e.target.value)}
                    />
                  </label>
                </div>
                <div className="habit-form__actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={resetCustom}
                  >
                    Cancelar
                  </button>
                  <Button type="submit" variant="primary" icon={<Check size={16} />}>
                    Guardar no plano
                  </Button>
                </div>
              </form>
            )}

            {slotItems.length === 0 && customMeal !== slot.id ? (
              <p className="nutri-meal__empty">Nada neste slot.</p>
            ) : (
              <ul className="nutri-plan__list">
                {slotItems.map((item) => {
                  const m = planItemMacros(item)
                  const editing = editingId === item.id
                  return (
                    <li key={item.id}>
                      <div className="nutri-plan__item">
                        <div>
                          <strong>{item.food.name}</strong>
                          {item.food.brand ? (
                            <em className="nutri-food__brand">
                              {item.food.brand}
                            </em>
                          ) : null}
                          <span>
                            {item.grams} g · {m.kcal} kcal · P {m.protein}
                          </span>
                        </div>
                        <div className="nutri-plan__item-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label="Editar"
                            onClick={() =>
                              setEditingId(editing ? null : item.id)
                            }
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label="Remover"
                            onClick={() => onRemoveItem(day, item.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      {editing && (
                        <PlanItemEdit
                          item={item}
                          onSave={(patch) => {
                            onUpdateItem(day, item.id, patch)
                            setEditingId(null)
                          }}
                          onCancel={() => setEditingId(null)}
                        />
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

function PlanItemEdit({
  item,
  onSave,
  onCancel,
}: {
  item: PlanItem
  onSave: (patch: { grams?: number; food?: FoodItem }) => void
  onCancel: () => void
}) {
  const [grams, setGrams] = useState(String(item.grams))
  const [name, setName] = useState(item.food.name)
  const [kcal, setKcal] = useState(String(item.food.per100.kcal))
  const [p, setP] = useState(String(item.food.per100.protein))
  const [c, setC] = useState(String(item.food.per100.carbs))
  const [f, setF] = useState(String(item.food.per100.fat))

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSave({
      grams: Number(grams) || item.grams,
      food: {
        ...item.food,
        name: name.trim() || item.food.name,
        per100: {
          kcal: Number(kcal) || 0,
          protein: Number(p) || 0,
          carbs: Number(c) || 0,
          fat: Number(f) || 0,
        },
      },
    })
  }

  return (
    <form className="nutri-plan__edit" onSubmit={handleSubmit}>
      <label className="plan-field">
        <span>Nome</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="nutri-plan__custom-grid">
        <label className="plan-field">
          <span>Porção (g/ml)</span>
          <input
            type="number"
            min={1}
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
          />
        </label>
        <label className="plan-field">
          <span>kcal/100</span>
          <input
            type="number"
            min={0}
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
          />
        </label>
        <label className="plan-field">
          <span>Prot</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={p}
            onChange={(e) => setP(e.target.value)}
          />
        </label>
        <label className="plan-field">
          <span>Carb</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={c}
            onChange={(e) => setC(e.target.value)}
          />
        </label>
        <label className="plan-field">
          <span>Gord</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={f}
            onChange={(e) => setF(e.target.value)}
          />
        </label>
      </div>
      <div className="habit-form__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
        <Button type="submit" variant="primary">
          Guardar
        </Button>
      </div>
    </form>
  )
}
