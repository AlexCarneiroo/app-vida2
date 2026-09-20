import { motion } from 'framer-motion'
import { Check, Plus, Repeat, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import {
  PageTransition,
  staggerContainer,
  staggerItem,
} from '../components/ui/PageTransition'
import { Button } from '../components/ui/Button'
import { ActivityHeatmap } from '../components/ui/ActivityHeatmap'
import { useConfirm, useToast } from '../components/ui/Feedback'
import { useBusyAction } from '../hooks/useBusyAction'
import { useRotina } from '../hooks/useRotina'

export function RotinaPage() {
  const {
    blocks,
    doneCount,
    total,
    dayLog,
    toggleBlock,
    addBlock,
    removeBlock,
  } = useRotina()
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const { busy: saving, run: runSave } = useBusyAction()
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [time, setTime] = useState('08:00')
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    void runSave(() => {
      addBlock(time, title, detail)
      setTitle('')
      setDetail('')
      setShowForm(false)
      toast('Bloco adicionado', 'ok')
    })
  }

  async function handleRemove(id: string, label: string) {
    const ok = await confirm({
      title: 'Excluir bloco?',
      message: `“${label}” sai da rotina.`,
      confirmLabel: 'Excluir',
    })
    if (!ok) return
    setRemovingId(id)
    try {
      removeBlock(id)
      toast('Bloco excluído', 'info')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <PageTransition>
      <header className="page-header">
        <div>
          <p className="page-kicker">Ritmo</p>
          <h1 className="page-title">Rotina</h1>
          <p className="page-sub">
            Blocos do dia com hora. Estrutura pronta para evoluir depois.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => setShowForm((v) => !v)}
          disabled={saving}
        >
          {showForm ? 'Fechar' : 'Novo'}
        </Button>
      </header>

      <div className="surface module-stat">
        <span className="module-stat__icon" style={{ color: 'var(--rotina)' }}>
          <Repeat size={18} />
        </span>
        <div>
          <strong>
            {doneCount}/{total} blocos
          </strong>
          <span>
            {total === 0
              ? 'Monta a linha do dia'
              : doneCount === total
                ? 'Rotina do dia feita'
                : 'Segue o ritmo'}
          </span>
        </div>
      </div>

      <ActivityHeatmap log={dayLog} title="Rotina no ano" />

      {showForm && (
        <form className="surface config-form" onSubmit={handleAdd}>
          <div className="finance-form__grid">
            <label className="plan-field">
              <span>Hora</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                disabled={saving}
              />
            </label>
            <label className="plan-field plan-field--grow">
              <span>Título</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Bloco profundo"
                required
                disabled={saving}
              />
            </label>
            <label className="plan-field plan-field--grow">
              <span>Detalhe</span>
              <input
                type="text"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="Ex.: 90 min sem notificações"
                disabled={saving}
              />
            </label>
          </div>
          <Button
            type="submit"
            variant="primary"
            icon={<Plus size={16} />}
            loading={saving}
            loadingLabel="A guardar…"
          >
            Guardar bloco
          </Button>
        </form>
      )}

      <div className="section-label">
        <h2>Linha do dia</h2>
        <span>{total}</span>
      </div>

      {blocks.length === 0 ? (
        <div className="surface finance-empty">
          <Repeat size={24} />
          <p>Ainda sem blocos. Adiciona o primeiro.</p>
        </div>
      ) : (
        <motion.div
          className="timeline"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {blocks.map((b) => (
            <motion.div
              key={b.id}
              className={`surface timeline-item${b.doneToday ? ' is-done' : ''}`}
              variants={staggerItem}
            >
              <button
                type="button"
                className={`habit-check${b.doneToday ? ' is-done' : ''}`}
                onClick={() => {
                  toggleBlock(b.id)
                  toast(
                    b.doneToday ? 'Bloco desmarcado' : 'Bloco concluído',
                    'ok',
                  )
                }}
                aria-label={
                  b.doneToday ? `Desmarcar ${b.title}` : `Concluir ${b.title}`
                }
              >
                {b.doneToday && <Check size={16} strokeWidth={3} />}
              </button>
              <time>{b.time}</time>
              <div>
                <strong>{b.title}</strong>
                <span>{b.detail || (b.doneToday ? 'Feito' : 'Pendente')}</span>
              </div>
              <Button
                variant="ghost"
                className="finance-row__del"
                icon={<Trash2 size={14} />}
                loading={removingId === b.id}
                onClick={() => handleRemove(b.id, b.title)}
                title="Excluir"
                aria-label={`Excluir ${b.title}`}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </PageTransition>
  )
}
