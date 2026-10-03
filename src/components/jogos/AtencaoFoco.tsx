import { useEffect, useRef, useState } from 'react'
import {
  clampScore,
  elapsedSec,
  pickOne,
  scaleByLevel,
  shuffle,
  type GameResult,
} from '../../lib/jogosEngine'
import { Button } from '../ui/Button'
import { GameFrame, GameResultView, type PlayProps } from './GameFrame'

const SHAPES = ['●', '■', '▲', '◆', '✚', '✶', '○', '◇'] as const

type Cell = { id: number; shape: string; target: boolean }

function makeRound(level: number): Cell[] {
  const size = Math.min(20, Math.round(scaleByLevel(level, 8, 18)))
  const target = pickOne(SHAPES)
  let distractor = pickOne(SHAPES)
  while (distractor === target) distractor = pickOne(SHAPES)
  // A partir do nível 5: dois tipos de distrator
  const distractor2 =
    level >= 5
      ? (() => {
          let d = pickOne(SHAPES)
          while (d === target || d === distractor) d = pickOne(SHAPES)
          return d
        })()
      : distractor
  const cells: Cell[] = Array.from({ length: size }, (_, id) => ({
    id,
    shape: id % 3 === 0 ? distractor2 : distractor,
    target: false,
  }))
  const idx = Math.floor(Math.random() * size)
  cells[idx] = { id: idx, shape: target, target: true }
  return shuffle(cells)
}

export function AtencaoFoco({ onFinish, onExit, startLevel }: PlayProps) {
  const started = useRef(Date.now())
  const done = useRef(false)
  const hits = useRef(0)
  const miss = useRef(0)
  const round = useRef(0)
  const levelRef = useRef(startLevel)
  const peak = useRef(startLevel)
  const totalRounds = Math.min(16, 10 + Math.floor(startLevel / 2))
  const [cells, setCells] = useState(() => makeRound(startLevel))
  const [leftMs, setLeftMs] = useState(() =>
    Math.round(scaleByLevel(startLevel, 2600, 1200)),
  )
  const [label, setLabel] = useState(`1/${totalRounds}`)
  const [levelLabel, setLevelLabel] = useState(startLevel)
  const [result, setResult] = useState<GameResult | null>(null)
  const deadline = useRef(Date.now() + leftMs)
  const timedOut = useRef(false)

  function armTimer(level: number) {
    const budget = Math.round(scaleByLevel(level, 2600, 900))
    deadline.current = Date.now() + budget
    timedOut.current = false
    setLeftMs(budget)
  }

  function reset() {
    const lv = Math.max(startLevel, peak.current)
    done.current = false
    started.current = Date.now()
    hits.current = 0
    miss.current = 0
    round.current = 0
    levelRef.current = lv
    setLevelLabel(lv)
    setCells(makeRound(lv))
    setLabel(`1/${totalRounds}`)
    setResult(null)
    armTimer(lv)
  }

  function finish() {
    if (done.current) return
    done.current = true
    const durationSec = elapsedSec(started.current)
    const level = Math.min(10, Math.max(startLevel, levelRef.current))
    peak.current = Math.max(peak.current, level)
    const score = clampScore(
      (hits.current / totalRounds) * 100 - miss.current * 4,
    )
    const res = { durationSec, score, level }
    setResult(res)
    onFinish(res)
  }

  function advance() {
    const next = round.current + 1
    if (next >= totalRounds || miss.current >= Math.max(3, 6 - Math.floor(startLevel / 3))) {
      finish()
      return
    }
    round.current = next
    const lv = Math.min(10, startLevel + Math.floor(next / 2))
    levelRef.current = lv
    peak.current = Math.max(peak.current, lv)
    setLevelLabel(lv)
    setLabel(`${next + 1}/${totalRounds}`)
    setCells(makeRound(lv))
    armTimer(lv)
  }

  useEffect(() => {
    if (result) return
    const id = window.setInterval(() => {
      const remain = Math.max(0, deadline.current - Date.now())
      setLeftMs(remain)
      if (remain <= 0 && !done.current && !timedOut.current) {
        timedOut.current = true
        miss.current += 1
        advance()
      }
    }, 50)
    return () => window.clearInterval(id)
  }, [result, cells])

  function tap(cell: Cell) {
    if (done.current || result) return
    if (cell.target) hits.current += 1
    else miss.current += 1
    advance()
  }

  if (result) {
    return (
      <GameResultView
        result={result}
        label="Foco rápido"
        onAgain={reset}
        onHub={onExit}
      />
    )
  }

  return (
    <GameFrame
      title="Foco rápido"
      hint={`Ronda ${label} · dificuldade ${levelLabel} · ${(leftMs / 1000).toFixed(1)}s`}
      footer={
        <Button variant="ghost" onClick={finish}>
          Terminar
        </Button>
      }
    >
      <div className="jogos-foco">
        {cells.map((cell) => (
          <button
            key={`${round.current}-${cell.id}-${cell.shape}`}
            type="button"
            className="jogos-foco__cell"
            onClick={() => tap(cell)}
          >
            {cell.shape}
          </button>
        ))}
      </div>
    </GameFrame>
  )
}
