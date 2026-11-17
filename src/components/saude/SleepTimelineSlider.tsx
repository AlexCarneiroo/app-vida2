import { Moon, Sun } from 'lucide-react'
import {
  useCallback,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { sleepHoursBetween } from '../../data/saudeDefaults'

/** Janela visual: 18:00 → 12:00 do dia seguinte (18h). */
const WINDOW_START = 18 * 60
const WINDOW_LEN = 18 * 60
const SNAP = 15
const MIN_SLEEP = 4 * 60
const MAX_SLEEP = 14 * 60

function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

function formatClock(totalMin: number): string {
  const day = ((totalMin % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(day / 60)
  const m = day % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function toOffset(clockMin: number, isWake: boolean): number {
  let offset = clockMin - WINDOW_START
  if (isWake && offset < 6 * 60) offset += 24 * 60
  if (!isWake && offset < 0) offset += 24 * 60
  return Math.max(0, Math.min(WINDOW_LEN, offset))
}

function fromOffset(offset: number): string {
  return formatClock(WINDOW_START + offset)
}

function snap(min: number): number {
  return Math.round(min / SNAP) * SNAP
}

function clampPair(bed: number, wake: number, moving: 'bed' | 'wake') {
  let nextBed = snap(bed)
  let nextWake = snap(wake)

  if (moving === 'bed') {
    nextBed = Math.max(0, Math.min(WINDOW_LEN - MIN_SLEEP, nextBed))
    if (nextWake - nextBed < MIN_SLEEP) nextWake = nextBed + MIN_SLEEP
    if (nextWake - nextBed > MAX_SLEEP) nextWake = nextBed + MAX_SLEEP
    nextWake = Math.min(WINDOW_LEN, nextWake)
  } else {
    nextWake = Math.max(MIN_SLEEP, Math.min(WINDOW_LEN, nextWake))
    if (nextWake - nextBed < MIN_SLEEP) nextBed = nextWake - MIN_SLEEP
    if (nextWake - nextBed > MAX_SLEEP) nextBed = nextWake - MAX_SLEEP
    nextBed = Math.max(0, nextBed)
  }

  return { bed: nextBed, wake: nextWake }
}

function vibrateSoft() {
  try {
    navigator.vibrate?.(8)
  } catch {
    /* ignore */
  }
}

type Handle = 'bed' | 'wake' | 'range'

export function SleepTimelineSlider({
  bedTime,
  wakeTime,
  onChange,
}: {
  bedTime: string
  wakeTime: string
  onChange: (bed: string, wake: string) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Handle | null>(null)
  const rangeOriginRef = useRef({ pointer: 0, bed: 0, wake: 0 })
  const offsetsRef = useRef({ bed: 0, wake: 0 })
  const lastEmitRef = useRef('')
  const [active, setActive] = useState<Handle | null>(null)
  const labelId = useId()

  const bedClock = parseClock(bedTime) ?? 22 * 60 + 30
  const wakeClock = parseClock(wakeTime) ?? 6 * 60 + 30
  const bedOffset = toOffset(bedClock, false)
  const wakeOffset = toOffset(wakeClock, true)
  offsetsRef.current = { bed: bedOffset, wake: wakeOffset }
  const hours = sleepHoursBetween(bedTime, wakeTime)
  const bedPct = (bedOffset / WINDOW_LEN) * 100
  const wakePct = (wakeOffset / WINDOW_LEN) * 100
  const midPct = (bedPct + wakePct) / 2

  const emitFromOffsets = useCallback(
    (bed: number, wake: number) => {
      offsetsRef.current = { bed, wake }
      const nextBed = fromOffset(bed)
      const nextWake = fromOffset(wake)
      const stamp = `${nextBed}|${nextWake}`
      if (stamp !== lastEmitRef.current) {
        lastEmitRef.current = stamp
        vibrateSoft()
      }
      onChange(nextBed, nextWake)
    },
    [onChange],
  )

  const offsetFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return ratio * WINDOW_LEN
  }, [])

  const moveHandle = useCallback(
    (handle: Handle, clientX: number) => {
      if (handle === 'range') {
        const delta = offsetFromClientX(clientX) - rangeOriginRef.current.pointer
        let bed = rangeOriginRef.current.bed + delta
        let wake = rangeOriginRef.current.wake + delta
        const span = rangeOriginRef.current.wake - rangeOriginRef.current.bed
        if (bed < 0) {
          bed = 0
          wake = span
        }
        if (wake > WINDOW_LEN) {
          wake = WINDOW_LEN
          bed = WINDOW_LEN - span
        }
        emitFromOffsets(snap(bed), snap(wake))
        return
      }

      const raw = offsetFromClientX(clientX)
      const { bed, wake } = offsetsRef.current
      const pair =
        handle === 'bed'
          ? clampPair(raw, wake, 'bed')
          : clampPair(bed, raw, 'wake')
      emitFromOffsets(pair.bed, pair.wake)
    },
    [emitFromOffsets, offsetFromClientX],
  )

  const endDrag = useCallback(() => {
    dragRef.current = null
    setActive(null)
  }, [])

  const onThumbDown = (handle: 'bed' | 'wake') => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = handle
    setActive(handle)
    moveHandle(handle, e.clientX)
  }

  const onRangeDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = 'range'
    setActive('range')
    rangeOriginRef.current = {
      pointer: offsetFromClientX(e.clientX),
      bed: offsetsRef.current.bed,
      wake: offsetsRef.current.wake,
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const handle = dragRef.current
    if (!handle) return
    moveHandle(handle, e.clientX)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    }
    endDrag()
  }

  const nudge = (handle: 'bed' | 'wake', delta: number) => {
    const { bed, wake } = offsetsRef.current
    const pair =
      handle === 'bed'
        ? clampPair(bed + delta, wake, 'bed')
        : clampPair(bed, wake + delta, 'wake')
    emitFromOffsets(pair.bed, pair.wake)
  }

  return (
    <div className="sleep-slider" aria-labelledby={labelId}>
      <div className="sleep-slider__head">
        <div className={`sleep-slider__side is-bed${active === 'bed' ? ' is-live' : ''}`}>
          <span className="sleep-slider__icon" aria-hidden>
            <Moon size={15} />
          </span>
          <div>
            <span className="sleep-slider__label">Deitar</span>
            <strong>{bedTime}</strong>
          </div>
        </div>
        <div className="sleep-slider__hours" aria-live="polite">
          <strong>{hours != null ? hours : '—'}</strong>
          <span>horas</span>
        </div>
        <div className={`sleep-slider__side is-wake${active === 'wake' ? ' is-live' : ''}`}>
          <div>
            <span className="sleep-slider__label">Acordar</span>
            <strong>{wakeTime}</strong>
          </div>
          <span className="sleep-slider__icon" aria-hidden>
            <Sun size={15} />
          </span>
        </div>
      </div>

      <p id={labelId} className="sleep-slider__hint">
        Arrasta as bolinhas — ou o intervalo no meio
      </p>

      <div
        ref={trackRef}
        className={`sleep-slider__track${active ? ' is-dragging' : ''}`}
      >
        <div className="sleep-slider__rail" aria-hidden />
        <div
          className={`sleep-slider__range${active === 'range' ? ' is-active' : ''}`}
          style={{ left: `${bedPct}%`, width: `${Math.max(0, wakePct - bedPct)}%` }}
          onPointerDown={onRangeDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <div
          className="sleep-slider__mid"
          style={{ left: `${midPct}%` }}
          aria-hidden
        >
          {hours != null ? `${hours}h` : ''}
        </div>

        <button
          type="button"
          className={`sleep-slider__thumb is-bed${active === 'bed' ? ' is-active' : ''}`}
          style={{ left: `${bedPct}%` }}
          aria-label={`Deitar ${bedTime}`}
          aria-valuetext={bedTime}
          onPointerDown={onThumbDown('bed')}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault()
              nudge('bed', -SNAP)
            } else if (e.key === 'ArrowRight') {
              e.preventDefault()
              nudge('bed', SNAP)
            }
          }}
        >
          <Moon size={15} />
        </button>

        <button
          type="button"
          className={`sleep-slider__thumb is-wake${active === 'wake' ? ' is-active' : ''}`}
          style={{ left: `${wakePct}%` }}
          aria-label={`Acordar ${wakeTime}`}
          aria-valuetext={wakeTime}
          onPointerDown={onThumbDown('wake')}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault()
              nudge('wake', -SNAP)
            } else if (e.key === 'ArrowRight') {
              e.preventDefault()
              nudge('wake', SNAP)
            }
          }}
        >
          <Sun size={15} />
        </button>
      </div>

      <div className="sleep-slider__ticks" aria-hidden>
        <span>18h</span>
        <span>00h</span>
        <span>06h</span>
        <span>12h</span>
      </div>
    </div>
  )
}
