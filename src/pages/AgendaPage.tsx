import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock3,
  List,
  Plus,
  Search,
  Settings2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { AgendaEventForm } from '../components/agenda/AgendaEventForm'
import { AgendaIcon } from '../components/agenda/AgendaIcon'
import {
  AgendaDayView,
  AgendaListView,
  AgendaMonthView,
  AgendaWeekView,
} from '../components/agenda/AgendaViews'
import { Button } from '../components/ui/Button'
import { useConfirm, useToast } from '../components/ui/Feedback'
import { PageHeader, PageScreens } from '../components/ui/PageShell'
import { PageTransition } from '../components/ui/PageTransition'
import {
  agendaCategoryEmoji,
  WORK_SHIFT_LABELS,
} from '../data/agendaDefaults'
import { useAgenda } from '../hooks/useAgenda'
import { useBusyAction } from '../hooks/useBusyAction'
import { useHabitos } from '../hooks/useHabitos'
import { useRotina } from '../hooks/useRotina'
import { useTreino } from '../hooks/useTreino'
import {
  availabilityForDay,
  buildDerivedItems,
  expandEvents,
  findConflicts,
  listRangeKeys,
  sortAgendaItems,
} from '../lib/agendaEngine'
import { dateKey, formatDateBR, shiftDateKey, weekDates } from '../lib/date'
import type {
  AgendaItem,
  AgendaListRange,
  AgendaViewMode,
  WorkShiftKind,
} from '../types/agenda'

type Panel = 'home' | 'create' | 'edit' | 'detail' | 'availability'

const VIEW_OPTIONS: { id: AgendaViewMode; label: string; icon: typeof List }[] =
  [
    { id: 'month', label: 'Mês', icon: CalendarDays },
    { id: 'week', label: 'Semana', icon: CalendarRange },
    { id: 'day', label: 'Dia', icon: Clock3 },
    { id: 'list', label: 'Lista', icon: List },
  ]

const LIST_RANGES: { id: AgendaListRange; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'tomorrow', label: 'Amanhã' },
  { id: 'week', label: 'Esta semana' },
  { id: 'next7', label: '7 dias' },
  { id: 'month', label: 'Este mês' },
]

export function AgendaPage() {
  const {
    state,
    categories,
    addEvent,
    updateEvent,
    removeEvent,
    cancelOccurrence,
    duplicateEvent,
    setEventStatus,
    setWeeklyAvailability,
    upsertException,
    removeException,
    setSleepWindow,
    eventById,
  } = useAgenda()
  const { plan, state: treinoState } = useTreino()
  const { habits } = useHabitos()
  const { blocks: rotinaBlocks } = useRotina()
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const { busy, run } = useBusyAction()

  const [panel, setPanel] = useState<Panel>('home')
  const [view, setView] = useState<AgendaViewMode>('month')
  const [anchor, setAnchor] = useState(() => new Date())
  const [selectedKey, setSelectedKey] = useState(() => dateKey())
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [listRange, setListRange] = useState<AgendaListRange>('next7')
  const [activeItem, setActiveItem] = useState<AgendaItem | null>(null)
  const [exceptionKind, setExceptionKind] = useState<WorkShiftKind>('extra')
  const [exceptionStart, setExceptionStart] = useState('08:00')
  const [exceptionEnd, setExceptionEnd] = useState('20:00')
  const [exceptionNote, setExceptionNote] = useState('')

  const todayKey = dateKey()
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const range = useMemo(() => {
    if (view === 'month') {
      const first = dateKey(new Date(anchor.getFullYear(), anchor.getMonth(), 1))
      const last = dateKey(
        new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0),
      )
      return {
        from: shiftDateKey(first, -7),
        to: shiftDateKey(last, 7),
      }
    }
    if (view === 'week') {
      const days = weekDates(anchor)
      return { from: dateKey(days[0]), to: dateKey(days[6]) }
    }
    if (view === 'day') {
      return { from: selectedKey, to: selectedKey }
    }
    return listRangeKeys(listRange, todayKey)
  }, [view, anchor, selectedKey, listRange, todayKey])

  const items = useMemo(() => {
    const native = expandEvents(
      state.events,
      range.from,
      range.to,
      categories,
    )
    const derived = buildDerivedItems({
      fromKey: range.from,
      toKey: range.to,
      plan,
      weekDone: treinoState.weekDone,
      habits,
      rotinaBlocks,
      todayKey,
    })
    let all = [...native, ...derived].sort(sortAgendaItems)
    if (categoryFilter !== 'all') {
      all = all.filter((i) => i.categoryId === categoryFilter)
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      all = all.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.detail.toLowerCase().includes(q),
      )
    }
    return all
  }, [
    state.events,
    categories,
    range,
    plan,
    treinoState.weekDone,
    habits,
    rotinaBlocks,
    todayKey,
    categoryFilter,
    query,
  ])

  const itemsByDay = useMemo(() => {
    const map = new Map<string, AgendaItem[]>()
    for (const item of items) {
      const list = map.get(item.dateKey) ?? []
      list.push(item)
      map.set(item.dateKey, list)
    }
    return map
  }, [items])

  const selectedItems = itemsByDay.get(selectedKey) ?? []
  const dayConflicts = useMemo(
    () => findConflicts(selectedItems),
    [selectedItems],
  )
  const availability = availabilityForDay(state, selectedKey)
  const weekDays = useMemo(() => weekDates(anchor), [anchor])

  const monthLabel = anchor.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })

  function goToday() {
    const d = new Date()
    setAnchor(d)
    setSelectedKey(dateKey(d))
  }

  function shiftPeriod(dir: -1 | 1) {
    const next = new Date(anchor)
    if (view === 'month') next.setMonth(next.getMonth() + dir)
    else if (view === 'week') next.setDate(next.getDate() + dir * 7)
    else next.setDate(next.getDate() + dir)
    setAnchor(next)
    if (view === 'day') setSelectedKey(dateKey(next))
  }

  function openCreate() {
    setActiveItem(null)
    setPanel('create')
  }

  function openDetail(item: AgendaItem) {
    setActiveItem(item)
    setSelectedKey(item.dateKey)
    setPanel('detail')
  }

  function openEdit() {
    if (!activeItem || activeItem.source !== 'event') return
    setPanel('edit')
  }

  function closePanel() {
    setPanel('home')
    setActiveItem(null)
  }

  async function handleDelete() {
    if (!activeItem || activeItem.source !== 'event') return
    const event = eventById.get(activeItem.sourceId)
    if (!event) return
    if (event.recurrence.freq !== 'none') {
      const onlyOne = await confirm({
        title: 'Cancelar só este dia?',
        message:
          'Este compromisso é recorrente. Confirma para cancelar apenas esta ocorrência. Para apagar a série toda, cancela e escolhe “Apagar série”.',
        confirmLabel: 'Só este dia',
        cancelLabel: 'Agora não',
      })
      if (onlyOne) {
        cancelOccurrence(event.id, activeItem.dateKey)
        toast('Ocorrência cancelada', 'info')
        closePanel()
      }
      return
    }
    const ok = await confirm({
      title: 'Excluir compromisso?',
      message: `“${event.title}” será removido da agenda.`,
      confirmLabel: 'Excluir',
    })
    if (!ok) return
    removeEvent(event.id)
    toast('Compromisso excluído', 'info')
    closePanel()
  }

  const editingEvent =
    activeItem?.source === 'event'
      ? eventById.get(activeItem.sourceId) ?? null
      : null

  return (
    <PageTransition>
      <PageHeader
        kicker="Organização"
        title={
          panel === 'create'
            ? 'Novo compromisso'
            : panel === 'edit'
              ? 'Editar compromisso'
              : panel === 'detail'
                ? 'Detalhe'
                : panel === 'availability'
                  ? 'Minha disponibilidade'
                  : 'Agenda'
        }
        sub={
          panel === 'home'
            ? 'O teu dia, semana e mês num só sítio — com treinos e hábitos incluídos.'
            : panel === 'availability'
              ? 'Define expediente, folgas e exceções do dia.'
              : 'Preenche o essencial; o resto é opcional.'
        }
        onBack={panel !== 'home' ? closePanel : undefined}
        action={
          panel === 'home' ? (
            <div className="agenda-header-actions">
              <Button
                variant="ghost"
                icon={<Settings2 size={16} />}
                onClick={() => setPanel('availability')}
              >
                Escala
              </Button>
              <Button
                variant="primary"
                icon={<Plus size={16} />}
                onClick={openCreate}
              >
                Novo
              </Button>
            </div>
          ) : undefined
        }
      />

      <PageScreens
        mode={panel === 'home' ? 'home' : panel}
        home={
          <div className="agenda-page">
            <section className="agenda-hero surface">
              <div>
                <p className="page-kicker">Agenda inteligente</p>
                <strong>
                  {selectedItems.length > 0
                    ? `${selectedItems.length} no dia selecionado`
                    : 'Espaço para organizar a vida'}
                </strong>
                <span>
                  {dayConflicts.length > 0
                    ? `${dayConflicts.length} conflito${dayConflicts.length > 1 ? 's' : ''} neste dia`
                    : availability.busy
                      ? `Trabalho ${availability.startTime ?? ''}–${availability.endTime ?? ''}`
                      : 'Dia sem expediente marcado'}
                </span>
              </div>
              <button
                type="button"
                className="agenda-hero__add"
                onClick={openCreate}
                aria-label="Adicionar compromisso"
              >
                <Plus size={22} />
              </button>
            </section>

            <div className="agenda-toolbar">
              <div className="agenda-toolbar__nav">
                <button
                  type="button"
                  className="agenda-nav-btn"
                  onClick={() => shiftPeriod(-1)}
                  aria-label="Anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <div>
                  <strong>
                    {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
                  </strong>
                  <span>Hoje · {formatDateBR(todayKey)}</span>
                </div>
                <button
                  type="button"
                  className="agenda-nav-btn"
                  onClick={() => shiftPeriod(1)}
                  aria-label="Seguinte"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  className="agenda-today-btn"
                  onClick={goToday}
                >
                  Hoje
                </button>
              </div>

              <div className="agenda-view-tabs" role="tablist">
                {VIEW_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="tab"
                      aria-selected={view === opt.id}
                      className={view === opt.id ? 'is-on' : undefined}
                      onClick={() => setView(opt.id)}
                    >
                      <Icon size={14} />
                      <span>{opt.label}</span>
                    </button>
                  )
                })}
              </div>

              <label className="agenda-search">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Pesquisar compromissos"
                />
              </label>

              <div className="agenda-filters">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filtrar categoria"
                >
                  <option value="all">Todas as categorias</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {agendaCategoryEmoji(c.id)} {c.label}
                    </option>
                  ))}
                </select>
                {view === 'list' && (
                  <select
                    value={listRange}
                    onChange={(e) =>
                      setListRange(e.target.value as AgendaListRange)
                    }
                    aria-label="Período da lista"
                  >
                    {LIST_RANGES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                {view === 'month' && (
                  <AgendaMonthView
                    anchor={anchor}
                    itemsByDay={itemsByDay}
                    selectedKey={selectedKey}
                    todayKey={todayKey}
                    onSelectDay={(key) => {
                      setSelectedKey(key)
                      setView('day')
                      setAnchor(new Date(`${key}T12:00:00`))
                    }}
                  />
                )}
                {view === 'week' && (
                  <AgendaWeekView
                    days={weekDays}
                    itemsByDay={itemsByDay}
                    todayKey={todayKey}
                    onSelectItem={openDetail}
                  />
                )}
                {view === 'day' && (
                  <AgendaDayView
                    dayKey={selectedKey}
                    items={selectedItems}
                    nowMinutes={nowMinutes}
                    workStart={availability.startTime}
                    workEnd={availability.endTime}
                    sleepStart={state.sleepStart}
                    sleepEnd={state.sleepEnd}
                    conflicts={dayConflicts}
                    onSelectItem={openDetail}
                  />
                )}
                {view === 'list' && (
                  <AgendaListView items={items} onSelectItem={openDetail} />
                )}
              </motion.div>
            </AnimatePresence>

            {view === 'month' && selectedItems.length > 0 && (
              <section className="surface agenda-day-preview">
                <header>
                  <div>
                    <p className="page-kicker">Pré-visualização</p>
                    <h2>{formatDateBR(selectedKey)}</h2>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setView('day')
                      setAnchor(new Date(`${selectedKey}T12:00:00`))
                    }}
                  >
                    Ver dia
                  </Button>
                </header>
                <AgendaListView
                  items={selectedItems}
                  onSelectItem={openDetail}
                />
              </section>
            )}

          </div>
        }
        panel={
          panel === 'create' || panel === 'edit' ? (
            <AgendaEventForm
              categories={categories}
              initial={panel === 'edit' ? editingEvent : null}
              defaultDateKey={selectedKey}
              busy={busy}
              onCancel={closePanel}
              onSubmit={(data) => {
                void run(() => {
                  if (panel === 'edit' && editingEvent) {
                    updateEvent(editingEvent.id, data)
                    toast('Compromisso atualizado', 'ok')
                  } else {
                    addEvent(data)
                    toast('Compromisso adicionado', 'ok')
                  }
                  closePanel()
                })
              }}
            />
          ) : panel === 'detail' && activeItem ? (
            <section className="surface agenda-detail">
              <span
                className="agenda-detail__swatch"
                style={{ background: activeItem.color }}
              />
              <p className="page-kicker agenda-detail__kicker">
                <AgendaIcon
                  categoryId={activeItem.categoryId}
                  source={activeItem.source}
                  size={14}
                />
                {activeItem.source === 'event'
                  ? 'Compromisso'
                  : activeItem.source === 'treino'
                    ? 'Treino do plano'
                    : activeItem.source === 'habito'
                      ? 'Hábito'
                      : 'Rotina'}
              </p>
              <h2>{activeItem.title}</h2>
              <p>
                {formatDateBR(activeItem.dateKey)}
                {activeItem.allDay
                  ? ' · Dia inteiro'
                  : ` · ${activeItem.startTime ?? '—'}–${activeItem.endTime ?? '—'}`}
              </p>
              {activeItem.detail ? <p>{activeItem.detail}</p> : null}
              <p className="agenda-detail__status">
                Estado: {activeItem.status}
              </p>

              {dayConflicts.length > 0 &&
                dayConflicts.some(
                  (c) =>
                    c.a.id === activeItem.id || c.b.id === activeItem.id,
                ) && (
                  <aside className="agenda-conflict-note">
                    Este horário sobrepõe outro compromisso. Revisa o dia ou
                    escolhe outro horário.
                  </aside>
                )}

              <div className="agenda-detail__actions">
                {activeItem.source === 'event' && (
                  <>
                    <Button variant="primary" onClick={openEdit}>
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEventStatus(
                          activeItem.sourceId,
                          activeItem.status === 'concluido'
                            ? 'pendente'
                            : 'concluido',
                        )
                        toast(
                          activeItem.status === 'concluido'
                            ? 'Marcado como pendente'
                            : 'Marcado como concluído',
                          'ok',
                        )
                        closePanel()
                      }}
                    >
                      {activeItem.status === 'concluido'
                        ? 'Reabrir'
                        : 'Concluir'}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        duplicateEvent(activeItem.sourceId, selectedKey)
                        toast('Compromisso duplicado', 'ok')
                        closePanel()
                      }}
                    >
                      Duplicar
                    </Button>
                    <Button variant="ghost" onClick={() => void handleDelete()}>
                      Excluir
                    </Button>
                    {editingEvent?.recurrence.freq !== 'none' && (
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Apagar série toda?',
                            message:
                              'Todas as ocorrências futuras deste compromisso serão removidas.',
                            confirmLabel: 'Apagar série',
                          })
                          if (!ok || !editingEvent) return
                          removeEvent(editingEvent.id)
                          toast('Série removida', 'info')
                          closePanel()
                        }}
                      >
                        Apagar série
                      </Button>
                    )}
                  </>
                )}
                {activeItem.source !== 'event' && (
                  <p className="page-sub">
                    Este item vem de outro módulo e atualiza automaticamente.
                  </p>
                )}
              </div>
            </section>
          ) : panel === 'availability' ? (
            <section className="surface agenda-availability">
              <h2>Expediente semanal</h2>
              <div className="agenda-availability__week">
                {state.weeklyAvailability.map((row) => (
                  <div key={row.dayOfWeek} className="agenda-availability__row">
                    <label className="field field--switch">
                      <span>
                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][
                          row.dayOfWeek
                        ]}
                      </span>
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) => {
                          const next = state.weeklyAvailability.map((r) =>
                            r.dayOfWeek === row.dayOfWeek
                              ? { ...r, enabled: e.target.checked }
                              : r,
                          )
                          setWeeklyAvailability(next)
                        }}
                      />
                    </label>
                    {row.enabled && (
                      <>
                        <input
                          type="time"
                          value={row.startTime}
                          onChange={(e) => {
                            const next = state.weeklyAvailability.map((r) =>
                              r.dayOfWeek === row.dayOfWeek
                                ? { ...r, startTime: e.target.value }
                                : r,
                            )
                            setWeeklyAvailability(next)
                          }}
                        />
                        <input
                          type="time"
                          value={row.endTime}
                          onChange={(e) => {
                            const next = state.weeklyAvailability.map((r) =>
                              r.dayOfWeek === row.dayOfWeek
                                ? { ...r, endTime: e.target.value }
                                : r,
                            )
                            setWeeklyAvailability(next)
                          }}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>

              <h2>Sono</h2>
              <div className="agenda-form__row">
                <label className="field">
                  <span>Deitar</span>
                  <input
                    type="time"
                    value={state.sleepStart}
                    onChange={(e) =>
                      setSleepWindow(e.target.value, state.sleepEnd)
                    }
                  />
                </label>
                <label className="field">
                  <span>Acordar</span>
                  <input
                    type="time"
                    value={state.sleepEnd}
                    onChange={(e) =>
                      setSleepWindow(state.sleepStart, e.target.value)
                    }
                  />
                </label>
              </div>

              <h2>Exceção para {formatDateBR(selectedKey)}</h2>
              <div className="agenda-form__row">
                <label className="field">
                  <span>Tipo</span>
                  <select
                    value={exceptionKind}
                    onChange={(e) =>
                      setExceptionKind(e.target.value as WorkShiftKind)
                    }
                  >
                    {Object.entries(WORK_SHIFT_LABELS).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {exceptionKind !== 'folga' && exceptionKind !== 'ferias' && (
                <div className="agenda-form__row">
                  <label className="field">
                    <span>Início</span>
                    <input
                      type="time"
                      value={exceptionStart}
                      onChange={(e) => setExceptionStart(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Fim</span>
                    <input
                      type="time"
                      value={exceptionEnd}
                      onChange={(e) => setExceptionEnd(e.target.value)}
                    />
                  </label>
                </div>
              )}
              <label className="field">
                <span>Nota</span>
                <input
                  value={exceptionNote}
                  onChange={(e) => setExceptionNote(e.target.value)}
                  placeholder="Ex.: cobertura até às 20h"
                />
              </label>
              <div className="agenda-form__actions">
                <Button
                  variant="primary"
                  onClick={() => {
                    upsertException({
                      dateKey: selectedKey,
                      kind: exceptionKind,
                      startTime:
                        exceptionKind === 'folga' || exceptionKind === 'ferias'
                          ? null
                          : exceptionStart,
                      endTime:
                        exceptionKind === 'folga' || exceptionKind === 'ferias'
                          ? null
                          : exceptionEnd,
                      note: exceptionNote,
                    })
                    toast('Disponibilidade atualizada', 'ok')
                  }}
                >
                  Guardar exceção
                </Button>
              </div>

              {state.exceptions.length > 0 && (
                <div className="agenda-exception-list">
                  {state.exceptions.slice(0, 8).map((ex) => (
                    <div key={ex.id} className="agenda-exception-row">
                      <div>
                        <strong>{formatDateBR(ex.dateKey)}</strong>
                        <span>
                          {WORK_SHIFT_LABELS[ex.kind]}
                          {ex.startTime
                            ? ` · ${ex.startTime}–${ex.endTime}`
                            : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => removeException(ex.id)}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null
        }
      />
    </PageTransition>
  )
}
