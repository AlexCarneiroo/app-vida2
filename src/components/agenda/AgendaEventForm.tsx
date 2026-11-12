import { type FormEvent, useState } from 'react'
import { Button } from '../ui/Button'
import {
  agendaCategoryEmoji,
  emptyRecurrence,
} from '../../data/agendaDefaults'
import type {
  AgendaCategory,
  AgendaEvent,
  AgendaPriority,
  AgendaRecurrenceFreq,
} from '../../types/agenda'
import { dateKey } from '../../lib/date'

const REMINDER_OPTIONS = [
  { value: 0, label: 'No horário' },
  { value: 5, label: '5 min antes' },
  { value: 15, label: '15 min antes' },
  { value: 30, label: '30 min antes' },
  { value: 60, label: '1 hora antes' },
  { value: 1440, label: '1 dia antes' },
]

const WEEKDAYS = [
  { value: 0, label: 'D' },
  { value: 1, label: 'S' },
  { value: 2, label: 'T' },
  { value: 3, label: 'Q' },
  { value: 4, label: 'Q' },
  { value: 5, label: 'S' },
  { value: 6, label: 'S' },
]

type Props = {
  categories: AgendaCategory[]
  initial?: AgendaEvent | null
  defaultDateKey?: string
  busy?: boolean
  onSubmit: (data: {
    title: string
    description: string
    dateKey: string
    allDay: boolean
    startTime: string | null
    endTime: string | null
    location: string
    categoryId: string
    priority: AgendaPriority
    color: string | null
    notes: string
    reminders: number[]
    recurrence: ReturnType<typeof emptyRecurrence>
  }) => void
  onCancel: () => void
}

export function AgendaEventForm({
  categories,
  initial,
  defaultDateKey,
  busy,
  onSubmit,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [day, setDay] = useState(initial?.dateKey ?? defaultDateKey ?? dateKey())
  const [allDay, setAllDay] = useState(initial?.allDay ?? false)
  const [startTime, setStartTime] = useState(initial?.startTime ?? '09:00')
  const [endTime, setEndTime] = useState(initial?.endTime ?? '10:00')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? categories[0]?.id ?? 'pessoal',
  )
  const [priority, setPriority] = useState<AgendaPriority>(
    initial?.priority ?? 'media',
  )
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [reminders, setReminders] = useState<number[]>(
    initial?.reminders?.length ? initial.reminders : [15],
  )
  const [freq, setFreq] = useState<AgendaRecurrenceFreq>(
    initial?.recurrence.freq ?? 'none',
  )
  const [weekdays, setWeekdays] = useState<number[]>(
    initial?.recurrence.weekdays?.length
      ? initial.recurrence.weekdays
      : [new Date(`${day}T12:00:00`).getDay()],
  )
  const [interval, setInterval] = useState(initial?.recurrence.interval ?? 1)
  const [untilDateKey, setUntilDateKey] = useState(
    initial?.recurrence.untilDateKey ?? '',
  )

  function toggleReminder(value: number) {
    setReminders((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    )
  }

  function toggleWeekday(value: number) {
    setWeekdays((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value].sort(),
    )
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({
      title,
      description,
      dateKey: day,
      allDay,
      startTime: allDay ? null : startTime,
      endTime: allDay ? null : endTime,
      location,
      categoryId,
      priority,
      color: null,
      notes,
      reminders: reminders.length ? reminders : [15],
      recurrence: {
        freq,
        weekdays: freq === 'weekly' || freq === 'custom' ? weekdays : [],
        interval: Math.max(1, interval),
        untilDateKey: untilDateKey || null,
      },
    })
  }

  return (
    <form className="agenda-form surface" onSubmit={handleSubmit}>
      <label className="field">
        <span>Título</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Consulta, reunião, prova…"
          required
        />
      </label>

      <label className="field">
        <span>Descrição</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Detalhe opcional"
        />
      </label>

      <div className="agenda-form__row">
        <label className="field">
          <span>Data</span>
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            required
          />
        </label>
        <label className="field field--switch">
          <span>Dia inteiro</span>
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
        </label>
      </div>

      {!allDay && (
        <div className="agenda-form__row">
          <label className="field">
            <span>Início</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Término</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </label>
        </div>
      )}

      <label className="field">
        <span>Local</span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Casa, escritório, online…"
        />
      </label>

      <div className="agenda-form__row">
        <label className="field">
          <span>Categoria</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {agendaCategoryEmoji(c.id)} {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Prioridade</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as AgendaPriority)}
          >
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </select>
        </label>
      </div>

      <label className="field">
        <span>Repetição</span>
        <select
          value={freq}
          onChange={(e) => setFreq(e.target.value as AgendaRecurrenceFreq)}
        >
          <option value="none">Não se repete</option>
          <option value="daily">Todos os dias</option>
          <option value="weekly">Toda semana</option>
          <option value="monthly">Todo mês</option>
          <option value="yearly">Todo ano</option>
          <option value="custom">Dias específicos</option>
        </select>
      </label>

      {(freq === 'weekly' || freq === 'custom') && (
        <div className="agenda-weekday-picks" role="group" aria-label="Dias">
          {WEEKDAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              className={`agenda-weekday-pick${weekdays.includes(d.value) ? ' is-on' : ''}`}
              onClick={() => toggleWeekday(d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      {freq !== 'none' && (
        <div className="agenda-form__row">
          <label className="field">
            <span>A cada</span>
            <input
              type="number"
              min={1}
              max={30}
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value) || 1)}
            />
          </label>
          <label className="field">
            <span>Até</span>
            <input
              type="date"
              value={untilDateKey}
              onChange={(e) => setUntilDateKey(e.target.value)}
            />
          </label>
        </div>
      )}

      <div className="field">
        <span>Lembretes</span>
        <div className="agenda-reminder-picks">
          {REMINDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`chip-toggle${reminders.includes(opt.value) ? ' is-on' : ''}`}
              onClick={() => toggleReminder(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span>Observações</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </label>

      <div className="agenda-form__actions">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={busy || !title.trim()}>
          {initial ? 'Guardar' : 'Adicionar'}
        </Button>
      </div>
    </form>
  )
}
