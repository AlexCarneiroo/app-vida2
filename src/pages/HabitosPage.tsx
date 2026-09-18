import { motion } from 'framer-motion'
import { Check, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import {
  PageTransition,
  staggerContainer,
  staggerItem,
} from '../components/ui/PageTransition'
import { useConfirm, useToast } from '../components/ui/Feedback'
import { useHabitos } from '../hooks/useHabitos'

export function HabitosPage() {
  const {
    habits,
    doneCount,
    total,
    toggleHabit,
    addHabit,
    removeHabit,
  } = useHabitos()
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const [name, setName] = useState('')
  const [detail, setDetail] = useState('')
  const [showForm, setShowForm] = useState(false)

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    addHabit(name, detail)
    setName('')
    setDetail('')
    setShowForm(false)
    toast('Hábito adicionado', 'ok')
  }

  async function handleRemove(id: string, label: string) {
    const ok = await confirm({
      title: 'Excluir hábito?',
      message: `“${label}” será removido.`,
      confirmLabel: 'Excluir',
    })
    if (!ok) return
    removeHabit(id)
    toast('Hábito excluído', 'info')
  }

  return (
    <PageTransition>
      <header className="page-header">
        <div>
          <p className="page-kicker">Consistência</p>
          <h1 className="page-title">Hábitos</h1>
          <p className="page-sub">
            Marca o dia, mantém o streak. Base pronta para crescer depois.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus size={16} />
          {showForm ? 'Fechar' : 'Novo'}
        </button>
      </header>

      <div className="surface module-stat">
        <span className="module-stat__icon" style={{ color: 'var(--habitos)' }}>
          <Sparkles size={18} />
        </span>
        <div>
          <strong>
            {doneCount}/{total} hoje
          </strong>
          <span>
            {total === 0
              ? 'Adiciona o primeiro hábito'
              : doneCount === total
                ? 'Dia completo'
                : 'Continua o ritmo'}
          </span>
        </div>
      </div>

      {showForm && (
        <form className="surface config-form" onSubmit={handleAdd}>
          <label className="plan-field">
            <span>Nome</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Beber água"
              required
            />
          </label>
          <label className="plan-field">
            <span>Nota (opcional)</span>
            <input
              type="text"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Ex.: Manhã"
            />
          </label>
          <button type="submit" className="btn btn--primary">
            <Plus size={16} />
            Guardar hábito
          </button>
        </form>
      )}

      <div className="section-label">
        <h2>Lista viva</h2>
        <span>{total}</span>
      </div>

      {habits.length === 0 ? (
        <div className="surface finance-empty">
          <Sparkles size={24} />
          <p>Ainda sem hábitos. Cria o primeiro.</p>
        </div>
      ) : (
        <motion.div
          className="surface habit-list"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {habits.map((h) => (
            <motion.div key={h.id} className="habit-row" variants={staggerItem}>
              <button
                type="button"
                className={`habit-check${h.doneToday ? ' is-done' : ''}`}
                onClick={() => {
                  toggleHabit(h.id)
                  toast(
                    h.doneToday ? 'Hábito desmarcado' : 'Hábito concluído',
                    'ok',
                  )
                }}
                aria-label={
                  h.doneToday ? `Desmarcar ${h.name}` : `Concluir ${h.name}`
                }
              >
                {h.doneToday && <Check size={16} strokeWidth={3} />}
              </button>
              <span className="habit-info">
                <strong>{h.name}</strong>
                <span>
                  {h.detail
                    ? `${h.detail} · `
                    : ''}
                  {h.doneToday ? 'Concluído hoje' : 'Pendente'}
                </span>
              </span>
              <span className="streak">{h.streak}d</span>
              <button
                type="button"
                className="btn btn--ghost finance-row__del"
                onClick={() => handleRemove(h.id, h.name)}
                title="Excluir"
              >
                <Trash2 size={14} />
              </button>
            </motion.div>
          ))}
        </motion.div>
      )}
    </PageTransition>
  )
}
