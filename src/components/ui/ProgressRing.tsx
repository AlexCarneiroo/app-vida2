import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useEffect, useState } from 'react'

type ProgressRingProps = {
  value: number
  size?: number
  stroke?: number
  color?: string
  track?: string
}

export function ProgressRing({
  value,
  size = 110,
  stroke = 8,
  color = '#2dd4a8',
  track = 'rgba(240, 230, 216, 0.12)',
}: ProgressRingProps) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = useMotionValue(0)
  const dashoffset = useTransform(progress, (v) => circumference * (1 - v / 100))
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const controls = animate(progress, value, {
      duration: 1.15,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    })
    return controls.stop
  }, [value, progress])

  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashoffset }}
        />
      </svg>
      <div className="ring-wrap__value">
        <span>
          {display}
          <span style={{ fontSize: '0.7rem', opacity: 0.55 }}>%</span>
        </span>
      </div>
    </div>
  )
}
