import { useRef, useState } from 'react'
import {
  clampScore,
  elapsedSec,
  shuffle,
  type GameResult,
} from '../../lib/jogosEngine'
import { GameFrame, GameResultView, type PlayProps } from './GameFrame'

type Puzzle = {
  prompt: string
  options: number[]
  answer: number
}

function makePuzzle(kind: number, hard: boolean): Puzzle {
  if (kind === 0) {
    const start = 2 + Math.floor(Math.random() * (hard ? 12 : 5))
    const step = 2 + Math.floor(Math.random() * (hard ? 5 : 3))
    const seq = [start, start + step, start + step * 2, start + step * 3]
    const answer = start + step * 4
    return {
      prompt: `${seq.join(', ')}, ?`,
      options: shuffle([answer, answer + step, answer - step, answer + 1]),
      answer,
    }
  }
  if (kind === 1) {
    const start = 2 + Math.floor(Math.random() * (hard ? 6 : 4))
    const seq = [start, start * 2, start * 4, start * 8]
    const answer = start * 16
    return {
      prompt: `${seq.join(', ')}, ?`,
      options: shuffle([answer, answer / 2, answer + start, answer * 2]),
      answer,
    }
  }
  if (kind === 2) {
    const a = 4 + Math.floor(Math.random() * (hard ? 14 : 8))
    const b = 2 + Math.floor(Math.random() * (hard ? 7 : 5))
    const seq = [a, a + b, a + b * 2 + 1, a + b * 3 + 3]
    const answer = a + b * 4 + 6
    return {
      prompt: `${seq.join(', ')}, ?`,
      options: shuffle([answer, answer - 1, answer + 2, answer - b]),
      answer,
    }
  }
  if (kind === 3 && hard) {
    // Fibonacci-like
    const a = 1 + Math.floor(Math.random() * 4)
    const b = a + 1 + Math.floor(Math.random() * 3)
    const seq = [a, b, a + b, a + 2 * b, 2 * a + 3 * b]
    const answer = 3 * a + 5 * b
    return {
      prompt: `${seq.join(', ')}, ?`,
      options: shuffle([answer, answer - a, answer + b, answer - b]),
      answer,
    }
  }
  const n = 5 + Math.floor(Math.random() * (hard ? 20 : 10))
  const seq = [n, n + 1, n - 1, n + 2]
  const answer = n - 2
  return {
    prompt: `${seq.join(', ')}, ?`,
    options: shuffle([answer, n + 3, n - 3, n]),
    answer,
  }
}

function makePuzzles(startLevel: number): Puzzle[] {
  const count = Math.min(12, 6 + Math.floor(startLevel / 2))
  return Array.from({ length: count }, (_, i) => {
    const level = Math.min(10, startLevel + Math.floor(i / 2))
    const hard = level >= 5
    const kind = hard ? i % 5 : i % 4
    return makePuzzle(kind, hard)
  })
}

export function RaciocinioPadroes({
  onFinish,
  onExit,
  startLevel,
}: PlayProps) {
  const started = useRef(Date.now())
  const peak = useRef(startLevel)
  const [puzzles, setPuzzles] = useState(() => makePuzzles(startLevel))
  const [idx, setIdx] = useState(0)
  const [hits, setHits] = useState(0)
  const [result, setResult] = useState<GameResult | null>(null)
  const puzzle = puzzles[idx]!
  const levelNow = Math.min(10, startLevel + Math.floor(idx / 2))

  function reset() {
    const lv = Math.max(startLevel, peak.current)
    started.current = Date.now()
    setPuzzles(makePuzzles(lv))
    setIdx(0)
    setHits(0)
    setResult(null)
  }

  function finish(h: number) {
    const durationSec = elapsedSec(started.current)
    const level = Math.min(10, Math.max(startLevel, levelNow))
    peak.current = Math.max(peak.current, level)
    const score = clampScore((h / puzzles.length) * 100)
    const res = { durationSec, score, level }
    setResult(res)
    onFinish(res)
  }

  function choose(n: number) {
    if (result) return
    const nextHits = hits + (n === puzzle.answer ? 1 : 0)
    if (n === puzzle.answer) setHits(nextHits)
    const next = idx + 1
    peak.current = Math.max(
      peak.current,
      Math.min(10, startLevel + Math.floor(next / 2)),
    )
    if (next >= puzzles.length) {
      finish(nextHits)
      return
    }
    setIdx(next)
  }

  if (result) {
    return (
      <GameResultView
        result={result}
        label="Padrões"
        onAgain={reset}
        onHub={onExit}
      />
    )
  }

  return (
    <GameFrame
      title="Padrões"
      hint={`Pergunta ${idx + 1}/${puzzles.length} · dificuldade ${levelNow}`}
    >
      <p className="jogos-padrao__prompt">{puzzle.prompt}</p>
      <div className="jogos-padrao__opts">
        {puzzle.options.map((n) => (
          <button
            key={`${idx}-${n}`}
            type="button"
            className="jogos-padrao__opt"
            onClick={() => choose(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </GameFrame>
  )
}
