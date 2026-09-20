import { Loader2 } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

const THRESHOLD = 76
const MAX_PULL = 118

type Props = {
  children: ReactNode
}

function isMobileTouch() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(hover: none) and (pointer: coarse)').matches ||
    window.matchMedia('(max-width: 899px)').matches
  )
}

export function PullToRefresh({ children }: Props) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const active = useRef(false)
  const pullRef = useRef(0)
  const refreshingRef = useRef(false)

  const setPullSafe = useCallback((value: number) => {
    pullRef.current = value
    setPull(value)
  }, [])

  useEffect(() => {
    refreshingRef.current = refreshing
  }, [refreshing])

  useEffect(() => {
    if (!isMobileTouch()) return

    const atTop = () =>
      (window.scrollY || document.documentElement.scrollTop || 0) <= 1

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || !atTop()) {
        active.current = false
        return
      }
      startY.current = e.touches[0]?.clientY ?? 0
      active.current = true
    }

    const onMove = (e: TouchEvent) => {
      if (!active.current || refreshingRef.current) return
      if (!atTop()) {
        active.current = false
        setPullSafe(0)
        return
      }

      const y = e.touches[0]?.clientY ?? 0
      const dy = y - startY.current
      if (dy <= 0) {
        setPullSafe(0)
        return
      }

      const next = Math.min(MAX_PULL, dy * 0.42)
      setPullSafe(next)
      if (next > 10 && e.cancelable) e.preventDefault()
    }

    const onEnd = () => {
      if (!active.current) return
      active.current = false

      if (refreshingRef.current) return

      if (pullRef.current >= THRESHOLD) {
        setRefreshing(true)
        setPullSafe(THRESHOLD)
        window.setTimeout(() => {
          window.location.reload()
        }, 280)
        return
      }

      setPullSafe(0)
    }

    const opts: AddEventListenerOptions = { passive: false }
    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, opts)
    document.addEventListener('touchend', onEnd)
    document.addEventListener('touchcancel', onEnd)

    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [setPullSafe])

  const progress = Math.min(1, pull / THRESHOLD)
  const visible = pull > 6 || refreshing

  return (
    <div className="ptr-root">
      <div
        className={`ptr-indicator${refreshing ? ' is-refreshing' : ''}${visible ? ' is-visible' : ''}`}
        style={{
          transform: `translate(-50%, ${Math.max(0, pull - 8)}px) scale(${0.72 + progress * 0.28})`,
          opacity: refreshing ? 1 : Math.min(1, progress * 1.15),
        }}
        aria-hidden={!visible}
      >
        <Loader2
          size={22}
          className={
            refreshing || progress >= 1
              ? 'ptr-indicator__spin'
              : 'ptr-indicator__icon'
          }
          style={
            refreshing || progress >= 1
              ? undefined
              : { transform: `rotate(${progress * 220}deg)` }
          }
        />
      </div>

      <div
        className="ptr-content"
        style={{
          transform:
            pull > 0 || refreshing
              ? `translateY(${refreshing ? THRESHOLD * 0.55 : pull * 0.55}px)`
              : undefined,
          transition:
            pull === 0 && !refreshing
              ? 'transform 0.28s var(--ease-out)'
              : undefined,
        }}
      >
        {children}
      </div>
    </div>
  )
}
