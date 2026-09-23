import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  buildHeatmap,
  buildMonthHeatmap,
  type DayActivity,
  type HeatmapCell,
} from '../../lib/activityHeatmap'
import { formatDateBR } from '../../lib/date'

type Props = {
  log: DayActivity
  title?: string
  /** Ano (~53 semanas) ou só o mês corrente. */
  range?: 'year' | 'month'
  /** Máximo de semanas no modo year (default 53). */
  weeks?: number
  className?: string
}

const WEEKDAY_LABELS = ['', 'Seg', '', 'Qua', '', 'Sex', ''] as const
const MONTH_DOW = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const
const DOW_COL = 22
const MIN_CELL = 8
const MAX_CELL = 14

function layoutForWidth(width: number, maxWeeks: number) {
  const gap = width < 420 ? 2 : width < 720 ? 2.5 : 3
  const available = Math.max(80, width - DOW_COL - 4)
  let weeks = Math.floor((available + gap) / (MIN_CELL + gap))
  weeks = Math.min(maxWeeks, Math.max(Math.min(12, maxWeeks), weeks))
  const cell = Math.min(
    MAX_CELL,
    Math.max(MIN_CELL, Math.floor((available - (weeks - 1) * gap) / weeks)),
  )
  const totalWidth = DOW_COL + weeks * cell + (weeks - 1) * gap
  const needsScroll = totalWidth > width + 2
  return { weeks, cell, gap, needsScroll }
}

export function ActivityHeatmap({
  log,
  title,
  range = 'year',
  weeks: maxWeeks = 53,
  className = '',
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState({
    weeks: 26,
    cell: 10,
    gap: 2,
    needsScroll: true,
  })
  const [tip, setTip] = useState<string | null>(null)

  useEffect(() => {
    if (range === 'month') return
    const el = scrollRef.current
    if (!el) return

    const measure = () => {
      const next = layoutForWidth(el.clientWidth, maxWeeks)
      setLayout((prev) =>
        prev.weeks === next.weeks &&
        prev.cell === next.cell &&
        prev.gap === next.gap &&
        prev.needsScroll === next.needsScroll
          ? prev
          : next,
      )
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxWeeks, range])

  const model = useMemo(() => {
    if (range === 'month') return buildMonthHeatmap(log)
    return buildHeatmap(log, layout.weeks)
  }, [log, layout.weeks, range])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || range === 'month') return
    requestAnimationFrame(() => {
      el.scrollLeft = el.scrollWidth
    })
  }, [layout.weeks, layout.cell, model.weeks.length, range])

  const monthName = useMemo(() => {
    const label = new Date().toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }, [])

  const heading =
    title ??
    (range === 'month'
      ? `${model.total} ${model.total === 1 ? 'treino' : 'treinos'} · ${monthName}`
      : `${model.total} ${model.total === 1 ? 'atividade' : 'atividades'} em ${model.year}`)

  const showTip = (cell: { dateKey: string; count: number }) => {
    setTip(
      `${formatDateBR(cell.dateKey)} · ${cell.count} ${cell.count === 1 ? 'atividade' : 'atividades'}`,
    )
  }

  if (range === 'month') {
    return (
      <MonthHeatmap
        weeks={model.weeks}
        total={model.total}
        heading={heading}
        monthName={monthName}
        tip={tip}
        className={className}
        onShowTip={showTip}
        onClearTip={() => setTip(null)}
      />
    )
  }

  return (
    <section
      className={`surface activity-map ${className}`.trim()}
      style={
        {
          '--am-cell': `${layout.cell}px`,
          '--am-gap': `${layout.gap}px`,
          '--am-weeks': layout.weeks,
        } as CSSProperties
      }
    >
      <div className="activity-map__head">
        <h2 className="activity-map__title">{heading}</h2>
        {tip && <p className="activity-map__tip">{tip}</p>}
      </div>

      <div className="activity-map__scroll" ref={scrollRef}>
        <div className="activity-map__grid-wrap">
          <div
            className="activity-map__months"
            style={{
              gridTemplateColumns: `repeat(${model.weeks.length}, var(--am-cell))`,
            }}
          >
            {model.weeks.map((_, wi) => {
              const label = model.monthLabels.find((m) => m.weekIndex === wi)
              return (
                <span key={wi} className="activity-map__month">
                  {label?.label ?? ''}
                </span>
              )
            })}
          </div>

          <div className="activity-map__body">
            <div className="activity-map__dows" aria-hidden>
              {WEEKDAY_LABELS.map((label, i) => (
                <span key={i}>{label}</span>
              ))}
            </div>

            <div
              className="activity-map__weeks"
              style={{
                gridTemplateColumns: `repeat(${model.weeks.length}, var(--am-cell))`,
              }}
            >
              {model.weeks.map((col, wi) => (
                <div key={wi} className="activity-map__week">
                  {col.map((cell) => (
                    <button
                      key={cell.dateKey}
                      type="button"
                      className={`activity-map__cell level-${cell.level}${cell.inRange ? '' : ' is-future'}`}
                      disabled={!cell.inRange}
                      aria-label={`${formatDateBR(cell.dateKey)}: ${cell.count} ${cell.count === 1 ? 'atividade' : 'atividades'}`}
                      onFocus={() => showTip(cell)}
                      onBlur={() => setTip(null)}
                      onMouseEnter={() => showTip(cell)}
                      onMouseLeave={() => setTip(null)}
                      onTouchStart={() => showTip(cell)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="activity-map__footer">
        <span className="activity-map__hint">
          {layout.needsScroll
            ? 'Desliza para ver mais semanas'
            : `${layout.weeks} semanas`}
        </span>
        <div className="activity-map__legend" aria-hidden>
          <span>Menos</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className={`activity-map__cell level-${level} is-swatch`}
            />
          ))}
          <span>Mais</span>
        </div>
      </div>
    </section>
  )
}

type MonthProps = {
  weeks: HeatmapCell[][]
  total: number
  heading: string
  monthName: string
  tip: string | null
  className: string
  onShowTip: (cell: { dateKey: string; count: number }) => void
  onClearTip: () => void
}

function MonthHeatmap({
  weeks,
  heading,
  monthName,
  tip,
  className,
  onShowTip,
  onClearTip,
}: MonthProps) {
  const now = new Date()
  const curMonth = now.getMonth()
  const curYear = now.getFullYear()
  const todayKey = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  return (
    <section
      className={`surface activity-map activity-map--month ${className}`.trim()}
    >
      <div className="activity-map__head">
        <h2 className="activity-map__title">{heading}</h2>
        {tip && <p className="activity-map__tip">{tip}</p>}
      </div>

      <div className="activity-map__month-cal" role="grid" aria-label={monthName}>
        <div className="activity-map__month-dows" aria-hidden>
          {MONTH_DOW.map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
        <div className="activity-map__month-grid">
          {weeks.map((week) =>
            week.map((cell) => {
              const [y, m, d] = cell.dateKey.split('-').map(Number)
              const inMonth = m - 1 === curMonth && y === curYear
              const isFuture = cell.dateKey > todayKey
              const dayNum = d
              const interactive = inMonth && !isFuture
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  role="gridcell"
                  className={[
                    'activity-map__month-day',
                    `level-${interactive ? cell.level : 0}`,
                    !inMonth ? 'is-outside' : '',
                    inMonth && isFuture ? 'is-future-day' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={!interactive}
                  aria-label={`${formatDateBR(cell.dateKey)}: ${cell.count} ${cell.count === 1 ? 'treino' : 'treinos'}`}
                  onFocus={() => interactive && onShowTip(cell)}
                  onBlur={onClearTip}
                  onMouseEnter={() => interactive && onShowTip(cell)}
                  onMouseLeave={onClearTip}
                  onTouchStart={() => interactive && onShowTip(cell)}
                >
                  <span className="activity-map__month-day-num">{dayNum}</span>
                </button>
              )
            }),
          )}
        </div>
      </div>

      <div className="activity-map__footer">
        <span className="activity-map__hint">{monthName}</span>
        <div className="activity-map__legend" aria-hidden>
          <span>Menos</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className={`activity-map__cell level-${level} is-swatch`}
            />
          ))}
          <span>Mais</span>
        </div>
      </div>
    </section>
  )
}
