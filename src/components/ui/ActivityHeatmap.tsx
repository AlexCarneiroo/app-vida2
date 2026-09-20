import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  buildHeatmap,
  type DayActivity,
} from '../../lib/activityHeatmap'
import { formatDateBR } from '../../lib/date'

type Props = {
  log: DayActivity
  title?: string
  /** Máximo de semanas (default 53 ≈ 1 ano). Em ecrãs estreitos reduz sozinho. */
  weeks?: number
  className?: string
}

const WEEKDAY_LABELS = ['', 'Seg', '', 'Qua', '', 'Sex', ''] as const
const DOW_COL = 22
const MIN_CELL = 8
const MAX_CELL = 14

function layoutForWidth(width: number, maxWeeks: number) {
  const gap = width < 420 ? 2 : width < 720 ? 2.5 : 3
  const available = Math.max(80, width - DOW_COL - 4)
  // Quantas semanas cabem com célula mínima
  let weeks = Math.floor((available + gap) / (MIN_CELL + gap))
  weeks = Math.min(maxWeeks, Math.max(12, weeks))
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
  }, [maxWeeks])

  const model = useMemo(
    () => buildHeatmap(log, layout.weeks),
    [log, layout.weeks],
  )

  // Mostra as semanas mais recentes (direita)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollLeft = el.scrollWidth
    })
  }, [layout.weeks, layout.cell, model.weeks.length])

  const heading =
    title ??
    `${model.total} ${model.total === 1 ? 'atividade' : 'atividades'} em ${model.year}`

  const showTip = (cell: { dateKey: string; count: number }) => {
    setTip(
      `${formatDateBR(cell.dateKey)} · ${cell.count} ${cell.count === 1 ? 'atividade' : 'atividades'}`,
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
