import { Timer, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatDuration } from '../../lib/date'
import type { TreinoSettings } from '../../types/treino'

const PRESETS: TreinoSettings['restSeconds'][] = [60, 90, 120]

type RestTimerProps = {
  duration: number
  restartKey: number
  preferredSeconds: TreinoSettings['restSeconds']
  onPreferredChange: (seconds: TreinoSettings['restSeconds']) => void
  onClose: () => void
}

export function RestTimer({
  duration,
  restartKey,
  preferredSeconds,
  onPreferredChange,
  onClose,
}: RestTimerProps) {
  const endAtRef = useRef(Date.now() + duration * 1000)
  const [left, setLeft] = useState(duration)
  const [total, setTotal] = useState(duration)
  const didVibrate = useRef(false)

  useEffect(() => {
    endAtRef.current = Date.now() + duration * 1000
    setTotal(duration)
    setLeft(duration)
    didVibrate.current = false
  }, [duration, restartKey])

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((endAtRef.current - Date.now()) / 1000),
      )
      setLeft(remaining)
      if (remaining <= 0 && !didVibrate.current) {
        didVibrate.current = true
        try {
          navigator.vibrate?.(180)
        } catch {
          /* ignore */
        }
      }
    }
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [duration, restartKey])

  const ratio = total <= 0 ? 0 : Math.min(1, left / total)
  const done = left <= 0

  function addSeconds(extra: number) {
    endAtRef.current += extra * 1000
    setTotal((t) => t + extra)
    setLeft((v) => v + extra)
    didVibrate.current = false
  }

  function restartWith(sec: TreinoSettings['restSeconds']) {
    onPreferredChange(sec)
    endAtRef.current = Date.now() + sec * 1000
    setTotal(sec)
    setLeft(sec)
    didVibrate.current = false
  }

  return (
    <div
      className={`rest-timer${done ? ' is-done' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="rest-timer__bar" aria-hidden>
        <div
          className="rest-timer__fill"
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>

      <div className="rest-timer__main">
        <div className="rest-timer__label">
          <Timer size={16} aria-hidden />
          <span>{done ? 'Descanso feito' : 'Descanso'}</span>
        </div>
        <strong className="rest-timer__time">
          {formatDuration(Math.max(0, left) * 1000)}
        </strong>
      </div>

      <div className="rest-timer__presets" role="group" aria-label="Duração">
        {PRESETS.map((sec) => (
          <button
            key={sec}
            type="button"
            className={`rest-timer__preset${preferredSeconds === sec ? ' is-active' : ''}`}
            onClick={() => restartWith(sec)}
          >
            {sec}s
          </button>
        ))}
        <button
          type="button"
          className="rest-timer__preset"
          onClick={() => addSeconds(15)}
        >
          +15s
        </button>
      </div>

      <div className="rest-timer__actions">
        <button
          type="button"
          className="rest-timer__skip"
          onClick={onClose}
          aria-label={done ? 'Fechar' : 'Pular descanso'}
        >
          <X size={16} />
          {done ? 'Fechar' : 'Pular'}
        </button>
        <button
          type="button"
          className="btn btn--primary rest-timer__cta"
          onClick={onClose}
        >
          {done ? 'Continuar' : 'Pular descanso'}
        </button>
      </div>
    </div>
  )
}
