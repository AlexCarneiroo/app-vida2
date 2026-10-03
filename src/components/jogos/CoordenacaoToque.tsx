import { useEffect, useRef, useState } from 'react'
import {
  clampScore,
  elapsedSec,
  scaleByLevel,
  type GameResult,
} from '../../lib/jogosEngine'
import { Button } from '../ui/Button'
import { GameFrame, GameResultView, type PlayProps } from './GameFrame'

export function CoordenacaoToque({
  onFinish,
  onExit,
  startLevel,
}: PlayProps) {
  const started = useRef(Date.now())
  const done = useRef(false)
  const count = useRef(0)
  const hits = useRef(0)
  const misses = useRef(0)
  const peak = useRef(startLevel)
  const total = Math.min(22, 12 + startLevel)
  const [pos, setPos] = useState({ x: 40, y: 40 })
  const [size, setSize] = useState(() =>
    Math.round(scaleByLevel(startLevel, 64, 34)),
  )
  const [leftMs, setLeftMs] = useState(() =>
    Math.round(scaleByLevel(startLevel, 1700, 800)),
  )
  const [label, setLabel] = useState(`1/${total}`)
  const [hitLabel, setHitLabel] = useState(0)
  const [levelLabel, setLevelLabel] = useState(startLevel)
  const [result, setResult] = useState<GameResult | null>(null)
  const deadline = useRef(Date.now() + leftMs)
  const timedOut = useRef(false)

  function place(nextCount: number, level: number) {
    const pad = 12
    setPos({
      x: pad + Math.random() * (100 - pad * 2 - 18),
      y: pad + Math.random() * (100 - pad * 2 - 18),
    })
    const baseSize = scaleByLevel(level, 64, 30)
    setSize(Math.max(28, baseSize - nextCount * 0.8))
    const budget = Math.max(
      520,
      scaleByLevel(level, 1700, 700) - nextCount * 35,
    )
    deadline.current = Date.now() + budget
    timedOut.current = false
    setLeftMs(budget)
    setLabel(`${nextCount + 1}/${total}`)
    setLevelLabel(level)
  }

  function reset() {
    const lv = Math.max(startLevel, peak.current)
    done.current = false
    started.current = Date.now()
    count.current = 0
    hits.current = 0
    misses.current = 0
    setHitLabel(0)
    setResult(null)
    place(0, lv)
  }

  function finish() {
    if (done.current) return
    done.current = true
    const durationSec = elapsedSec(started.current)
    const level = Math.min(
      10,
      Math.max(startLevel, startLevel + Math.floor(hits.current / 3)),
    )
    peak.current = Math.max(peak.current, level)
    const score = clampScore(
      (hits.current / total) * 100 - misses.current * 5,
    )
    const res = { durationSec, score, level }
    setResult(res)
    onFinish(res)
  }

  function nextAfter(miss: boolean) {
    if (miss) misses.current += 1
    const next = count.current + 1
    const lv = Math.min(10, startLevel + Math.floor(next / 3))
    peak.current = Math.max(peak.current, lv)
    if (
      next >= total ||
      misses.current >= Math.max(3, 7 - Math.floor(startLevel / 3))
    ) {
      finish()
      return
    }
    count.current = next
    place(next, lv)
  }

  useEffect(() => {
    place(0, startLevel)
  }, [startLevel])

  useEffect(() => {
    if (result) return
    const id = window.setInterval(() => {
      const remain = Math.max(0, deadline.current - Date.now())
      setLeftMs(remain)
      if (remain <= 0 && !done.current && !timedOut.current) {
        timedOut.current = true
        nextAfter(true)
      }
    }, 40)
    return () => window.clearInterval(id)
  }, [result, label])

  function hit() {
    if (done.current || result) return
    hits.current += 1
    setHitLabel(hits.current)
    nextAfter(false)
  }

  if (result) {
    return (
      <GameResultView
        result={result}
        label="Toque certeiro"
        onAgain={reset}
        onHub={onExit}
      />
    )
  }

  return (
    <GameFrame
      title="Toque certeiro"
      hint={`Alvo ${label} · dificuldade ${levelLabel} · ${(leftMs / 1000).toFixed(1)}s · acertos ${hitLabel}`}
      footer={
        <Button variant="ghost" onClick={finish}>
          Terminar
        </Button>
      }
    >
      <div className="jogos-tap">
        <button
          type="button"
          className="jogos-tap__target"
          style={{
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            width: size,
            height: size,
          }}
          onClick={hit}
          aria-label="Alvo"
        />
      </div>
    </GameFrame>
  )
}
