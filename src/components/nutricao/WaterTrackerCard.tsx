import { Droplets } from 'lucide-react'
import { useState } from 'react'
import { waterServingSlots } from '../../data/nutricaoDefaults'

type Props = {
  waterMl: number
  waterGoalMl: number
  servingMl: number
  onSetServings: (n: number) => void
  onSetServingMl: (ml: number) => void
  className?: string
}

export function WaterTrackerCard({
  waterMl,
  waterGoalMl,
  servingMl,
  onSetServings,
  onSetServingMl,
  className,
}: Props) {
  const [bottleDraft, setBottleDraft] = useState<string | null>(null)
  const bottleDisplay = bottleDraft ?? String(servingMl)
  const slots = waterServingSlots(waterGoalMl, servingMl)
  const currentServings = Math.round(waterMl / Math.max(1, servingMl))

  function commitBottleDraft() {
    const raw = bottleDraft
    setBottleDraft(null)
    if (raw === null) return
    const trimmed = raw.trim()
    if (trimmed === '') {
      onSetServingMl(0)
      return
    }
    const n = Number(trimmed)
    onSetServingMl(Number.isFinite(n) ? n : 0)
  }

  return (
    <section className={`surface nutri-water${className ? ` ${className}` : ''}`}>
      <div className="nutri-water__head">
        <Droplets size={16} />
        <strong>Água</strong>
        <span>
          {waterMl} / {waterGoalMl} ml
        </span>
      </div>
      <p className="nutri-water__hint">
        Cada marca = {servingMl} ml (tua garrafa).
      </p>
      <div
        className="nutri-water__glasses"
        role="group"
        aria-label="Garrafas de água"
      >
        {Array.from({ length: slots }, (_, i) => {
          const n = i + 1
          const filledMl = n * servingMl
          const filled = waterMl >= filledMl
          return (
            <button
              key={n}
              type="button"
              className={`nutri-bottle${filled ? ' is-filled' : ''}`}
              aria-pressed={filled}
              aria-label={`${servingMl} ml · garrafa ${n}`}
              onClick={() =>
                onSetServings(currentServings === n ? n - 1 : n)
              }
            >
              <span className="nutri-bottle__body" />
              <em>{servingMl}</em>
            </button>
          )
        })}
      </div>
      <label className="nutri-water__serving">
        <span>Garrafa (ml)</span>
        <input
          type="number"
          min={0}
          max={2000}
          step={50}
          inputMode="numeric"
          value={bottleDisplay}
          onChange={(e) => setBottleDraft(e.target.value)}
          onBlur={commitBottleDraft}
        />
      </label>
    </section>
  )
}
