import { motion, useReducedMotion } from 'framer-motion'
import type { CSSProperties } from 'react'
import {
  dayLoadScore,
  layoutTimedItems,
  minutesToTime,
  monthGrid,
  parseTimeToMinutes,
  type AgendaConflict,
} from '../../lib/agendaEngine'
import { dateKey } from '../../lib/date'
import type { AgendaItem } from '../../types/agenda'
import { staggerContainer, staggerItem } from '../ui/PageTransition'
import { AgendaIcon } from './AgendaIcon'

const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6)

function statusClass(status: AgendaItem['status']) {
  return `is-${status}`
}

function statusLabel(status: AgendaItem['status']) {
  if (status === 'concluido') return 'feito'
  if (status === 'atrasado') return 'atrasado'
  if (status === 'cancelado') return 'cancelado'
  return 'pendente'
}

function blockGeometry(col: number, cols: number): CSSProperties {
  if (cols <= 1) {
    return {
      left: '0.3rem',
      right: '0.3rem',
      width: 'auto',
    }
  }
  const gap = 0.18
  const inset = 0.22
  const width = `calc((100% - ${inset * 2}rem - ${(cols - 1) * gap}rem) / ${cols})`
  const left = `calc(${inset}rem + ${col} * ((100% - ${inset * 2}rem - ${(cols - 1) * gap}rem) / ${cols} + ${gap}rem))`
  return { left, width, right: 'auto' }
}

function AgendaEventBlock({
  item,
  compact,
  showTime,
  dense,
  className,
  style,
  onSelect,
  motionProps,
}: {
  item: AgendaItem
  compact?: boolean
  showTime?: boolean
  dense?: boolean
  className?: string
  style?: CSSProperties
  onSelect: (item: AgendaItem) => void
  motionProps?: Record<string, unknown>
}) {
  const iconSize = dense || compact ? 12 : 14
  const content = (
    <>
      <span className="agenda-block__row">
        <AgendaIcon
          className="agenda-block__icon"
          categoryId={item.categoryId}
          source={item.source}
          size={iconSize}
        />
        <strong className="agenda-block__title">{item.title}</strong>
      </span>
      {showTime && !item.allDay && item.startTime && (
        <em className="agenda-block__time">
          {item.startTime}
          {item.endTime ? `–${item.endTime}` : ''}
        </em>
      )}
    </>
  )

  if (motionProps) {
    return (
      <motion.button
        type="button"
        className={className}
        style={style}
        onClick={() => onSelect(item)}
        title={`${item.title}${item.startTime ? ` · ${item.startTime}–${item.endTime ?? ''}` : ''}`}
        {...motionProps}
      >
        {content}
      </motion.button>
    )
  }

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => onSelect(item)}
      title={`${item.title}${item.startTime ? ` · ${item.startTime}–${item.endTime ?? ''}` : ''}`}
    >
      {content}
    </button>
  )
}

export function AgendaMonthView({
  anchor,
  itemsByDay,
  selectedKey,
  todayKey,
  onSelectDay,
}: {
  anchor: Date
  itemsByDay: Map<string, AgendaItem[]>
  selectedKey: string
  todayKey: string
  onSelectDay: (key: string) => void
}) {
  const cells = monthGrid(anchor)
  const reduce = useReducedMotion()

  return (
    <motion.div
      className="agenda-month"
      key={`${anchor.getFullYear()}-${anchor.getMonth()}`}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="agenda-month__head">
        {DAY_SHORT.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <motion.div
        className="agenda-month__grid"
        variants={reduce ? undefined : staggerContainer}
        initial={reduce ? undefined : 'hidden'}
        animate={reduce ? undefined : 'show'}
      >
        {cells.map((day) => {
          const key = dateKey(day)
          const inMonth = day.getMonth() === anchor.getMonth()
          const items = itemsByDay.get(key) ?? []
          const dots = items.slice(0, 4)
          return (
            <motion.button
              key={key}
              type="button"
              variants={reduce ? undefined : staggerItem}
              className={`agenda-month__cell${!inMonth ? ' is-out' : ''}${key === todayKey ? ' is-today' : ''}${key === selectedKey ? ' is-selected' : ''}${items.length > 0 ? ' has-items' : ''}`}
              onClick={() => onSelectDay(key)}
            >
              <div className="agenda-month__top">
                <strong>{day.getDate()}</strong>
                {items.length > 0 && <small>{items.length}</small>}
              </div>
              <div className="agenda-month__dots">
                {dots.map((item) => (
                  <span
                    key={item.id}
                    style={{ background: item.color }}
                    title={item.title}
                  />
                ))}
              </div>
              {items.length > 0 && (
                <em className="agenda-month__preview">
                  <AgendaIcon
                    categoryId={items[0].categoryId}
                    source={items[0].source}
                    size={10}
                  />
                  <span>
                    {items[0].title}
                    {items.length > 1 ? ` +${items.length - 1}` : ''}
                  </span>
                </em>
              )}
            </motion.button>
          )
        })}
      </motion.div>
    </motion.div>
  )
}

export function AgendaWeekView({
  days,
  itemsByDay,
  todayKey,
  onSelectItem,
}: {
  days: Date[]
  itemsByDay: Map<string, AgendaItem[]>
  todayKey: string
  onSelectItem: (item: AgendaItem) => void
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className="agenda-week"
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="agenda-week__times" aria-hidden>
        <span />
        {HOURS.map((h) => (
          <span key={h}>{String(h).padStart(2, '0')}:00</span>
        ))}
      </div>
      <div className="agenda-week__cols">
        {days.map((day) => {
          const key = dateKey(day)
          const dayItems = itemsByDay.get(key) ?? []
          const allDay = dayItems.filter((i) => i.allDay)
          const laidOut = layoutTimedItems(dayItems)
          return (
            <div
              key={key}
              className={`agenda-week__col${key === todayKey ? ' is-today' : ''}`}
            >
              <header>
                <span>{DAY_SHORT[day.getDay()]}</span>
                <strong>{day.getDate()}</strong>
              </header>
              {allDay.length > 0 && (
                <div className="agenda-week__allday">
                  {allDay.slice(0, 2).map((item) => (
                    <AgendaEventBlock
                      key={item.id}
                      item={item}
                      dense
                      className={`agenda-block is-allday ${statusClass(item.status)}`}
                      style={{ '--evt': item.color } as CSSProperties}
                      onSelect={onSelectItem}
                    />
                  ))}
                </div>
              )}
              <div className="agenda-week__track">
                {laidOut.map((slot) => {
                  const compact = slot.duration <= 40 || slot.cols > 1
                  return (
                    <AgendaEventBlock
                      key={slot.item.id}
                      item={slot.item}
                      compact={compact}
                      dense
                      showTime={slot.duration > 45 && slot.cols === 1}
                      className={`agenda-block is-day${compact ? ' is-compact' : ''} ${statusClass(slot.item.status)}`}
                      style={
                        {
                          '--evt': slot.item.color,
                          top: `${slot.top}%`,
                          height: `${slot.height}%`,
                          ...blockGeometry(slot.col, slot.cols),
                        } as CSSProperties
                      }
                      onSelect={onSelectItem}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

export function AgendaDayView({
  dayKey,
  items,
  nowMinutes,
  workStart,
  workEnd,
  sleepStart,
  sleepEnd,
  conflicts,
  onSelectItem,
}: {
  dayKey: string
  items: AgendaItem[]
  nowMinutes: number
  workStart: string | null
  workEnd: string | null
  sleepStart: string
  sleepEnd: string
  conflicts: AgendaConflict[]
  onSelectItem: (item: AgendaItem) => void
}) {
  const conflictIds = new Set(conflicts.flatMap((c) => [c.a.id, c.b.id]))
  const load = dayLoadScore(items)
  const today = dateKey() === dayKey
  const reduce = useReducedMotion()
  const laidOut = layoutTimedItems(items)
  const nowTop =
    today && nowMinutes >= 6 * 60 && nowMinutes <= 22 * 60
      ? ((nowMinutes - 6 * 60) / (16 * 60)) * 100
      : null

  return (
    <motion.div
      className="agenda-day"
      key={dayKey}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="agenda-day__meta">
        <p>
          {load.count === 0
            ? 'Dia livre'
            : `${load.count} atividade${load.count === 1 ? '' : 's'} · ${Math.round(load.minutes / 60)}h ocupadas`}
        </p>
        {workStart && workEnd ? (
          <span className="agenda-pill is-work">
            Trabalho {workStart}–{workEnd}
          </span>
        ) : null}
        <span className="agenda-pill is-sleep">
          Sono {sleepStart}–{sleepEnd}
        </span>
        {load.overloaded && (
          <span className="agenda-pill is-warn">Dia carregado</span>
        )}
        {conflicts.length > 0 && (
          <span className="agenda-pill is-warn">
            {conflicts.length} conflito{conflicts.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="agenda-day__timeline">
        <div className="agenda-day__hours" aria-hidden>
          {HOURS.map((h) => (
            <span key={h}>{String(h).padStart(2, '0')}</span>
          ))}
        </div>
        <div className="agenda-day__canvas">
          {workStart && workEnd && (
            <div
              className="agenda-band is-work"
              style={bandStyle(workStart, workEnd)}
              aria-hidden
            />
          )}
          <div
            className="agenda-band is-sleep"
            style={bandStyle(sleepStart, sleepEnd, true)}
            aria-hidden
          />
          {nowTop !== null && (
            <div className="agenda-now" style={{ top: `${nowTop}%` }}>
              <span>{minutesToTime(nowMinutes)}</span>
            </div>
          )}
          {laidOut.map((slot, index) => {
            const compact = slot.duration <= 35 || slot.cols > 2
            const showTime = slot.duration > 35 && slot.cols <= 2
            return (
              <AgendaEventBlock
                key={slot.item.id}
                item={slot.item}
                compact={compact}
                showTime={showTime}
                className={`agenda-block is-day${compact ? ' is-compact' : ''} ${statusClass(slot.item.status)}${conflictIds.has(slot.item.id) ? ' is-conflict' : ''}`}
                style={
                  {
                    '--evt': slot.item.color,
                    top: `${slot.top}%`,
                    height: `${slot.height}%`,
                    ...blockGeometry(slot.col, slot.cols),
                  } as CSSProperties
                }
                onSelect={onSelectItem}
                motionProps={
                  reduce
                    ? undefined
                    : {
                        initial: { opacity: 0, y: 4 },
                        animate: { opacity: 1, y: 0 },
                        transition: { delay: index * 0.025, duration: 0.2 },
                      }
                }
              />
            )
          })}
        </div>
      </div>

      {items.some((i) => i.allDay) && (
        <div className="agenda-day__allday">
          <p className="page-kicker">Dia inteiro</p>
          {items
            .filter((i) => i.allDay)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                className={`agenda-list-item ${statusClass(item.status)}`}
                onClick={() => onSelectItem(item)}
              >
                <span style={{ background: item.color }} />
                <div>
                  <strong className="agenda-list-item__title">
                    <AgendaIcon
                      categoryId={item.categoryId}
                      source={item.source}
                      size={14}
                    />
                    {item.title}
                  </strong>
                  <em>{item.detail || 'Dia inteiro'}</em>
                </div>
              </button>
            ))}
        </div>
      )}
    </motion.div>
  )
}

function bandStyle(start: string, end: string, wrap = false) {
  const s = parseTimeToMinutes(start) ?? 0
  const e = parseTimeToMinutes(end) ?? 0
  if (!wrap || e > s) {
    const top = ((Math.max(s, 6 * 60) - 6 * 60) / (16 * 60)) * 100
    const bottom = ((Math.min(e, 22 * 60) - 6 * 60) / (16 * 60)) * 100
    return {
      top: `${top}%`,
      height: `${Math.max(2, bottom - top)}%`,
    } as CSSProperties
  }
  const top = ((Math.max(s, 6 * 60) - 6 * 60) / (16 * 60)) * 100
  return {
    top: `${top}%`,
    height: `${Math.max(2, 100 - top)}%`,
  } as CSSProperties
}

export function AgendaListView({
  items,
  onSelectItem,
}: {
  items: AgendaItem[]
  onSelectItem: (item: AgendaItem) => void
}) {
  let lastDay = ''
  const reduce = useReducedMotion()
  return (
    <motion.div
      className="agenda-list"
      variants={reduce ? undefined : staggerContainer}
      initial={reduce ? undefined : 'hidden'}
      animate={reduce ? undefined : 'show'}
    >
      {items.length === 0 && (
        <div className="agenda-empty">
          <AgendaIcon categoryId="outros" size={28} />
          <p>Nenhum compromisso neste período.</p>
          <em>Adiciona um ou muda o filtro.</em>
        </div>
      )}
      {items.map((item) => {
        const showHead = item.dateKey !== lastDay
        lastDay = item.dateKey
        const label = new Date(`${item.dateKey}T12:00:00`).toLocaleDateString(
          'pt-BR',
          { weekday: 'long', day: 'numeric', month: 'short' },
        )
        return (
          <motion.div
            key={item.id}
            variants={reduce ? undefined : staggerItem}
            className="agenda-list__group"
          >
            {showHead && (
              <p className="agenda-list__day">
                {label.charAt(0).toUpperCase() + label.slice(1)}
              </p>
            )}
            <button
              type="button"
              className={`agenda-list-item ${statusClass(item.status)}`}
              onClick={() => onSelectItem(item)}
            >
              <span style={{ background: item.color }} />
              <div>
                <strong className="agenda-list-item__title">
                  <AgendaIcon
                    categoryId={item.categoryId}
                    source={item.source}
                    size={14}
                  />
                  {item.title}
                </strong>
                <em>
                  {item.allDay
                    ? 'Dia inteiro'
                    : `${item.startTime ?? '—'}–${item.endTime ?? '—'}`}
                  {item.source !== 'event' ? ` · ${item.source}` : ''}
                  {item.detail ? ` · ${item.detail}` : ''}
                </em>
              </div>
              <small>{statusLabel(item.status)}</small>
            </button>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
