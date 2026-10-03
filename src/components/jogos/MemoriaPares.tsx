import { useMemo, useRef, useState } from 'react'
import {
  clampScore,
  elapsedSec,
  shuffle,
  type GameResult,
} from '../../lib/jogosEngine'
import { GameFrame, GameResultView, type PlayProps } from './GameFrame'

const EMOJIS = [
  '🌿',
  '🌊',
  '🔥',
  '🌙',
  '⭐',
  '🍀',
  '🦊',
  '🦉',
  '🍋',
  '🎈',
]

type Card = { id: number; emoji: string; matched: boolean }

/** Pares por fase: sobe ao concluir o tabuleiro. */
function pairsForStage(stage: number, startLevel: number) {
  const base = Math.min(4 + Math.floor((startLevel - 1) / 3), 6)
  return Math.min(10, base + stage)
}

function flipDelayMs(stage: number, startLevel: number) {
  return Math.max(280, 700 - stage * 70 - startLevel * 25)
}

function buildDeck(pairCount: number): Card[] {
  const pairs = shuffle(EMOJIS).slice(0, pairCount)
  return shuffle(
    pairs.flatMap((emoji, i) => [
      { id: i * 2, emoji, matched: false },
      { id: i * 2 + 1, emoji, matched: false },
    ]),
  )
}

export function MemoriaPares({ onFinish, onExit, startLevel }: PlayProps) {
  const started = useRef(Date.now())
  const peak = useRef(startLevel)
  const [stage, setStage] = useState(0)
  const [deck, setDeck] = useState(() =>
    buildDeck(pairsForStage(0, startLevel)),
  )
  const [open, setOpen] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [lock, setLock] = useState(false)
  const [result, setResult] = useState<GameResult | null>(null)
  const pairGoal = pairsForStage(stage, startLevel)
  const matched = useMemo(
    () => deck.filter((c) => c.matched).length / 2,
    [deck],
  )

  function reset() {
    const nextStart = Math.max(startLevel, peak.current)
    started.current = Date.now()
    setStage(0)
    setDeck(buildDeck(pairsForStage(0, nextStart)))
    setOpen([])
    setMoves(0)
    setLock(false)
    setResult(null)
  }

  function finish(finalStage: number, finalMoves: number) {
    const level = Math.min(10, startLevel + finalStage + 1)
    peak.current = Math.max(peak.current, level)
    const durationSec = elapsedSec(started.current)
    const score = clampScore(
      55 +
        finalStage * 12 +
        startLevel * 3 -
        Math.max(0, finalMoves - pairGoal) * 3 -
        Math.max(0, durationSec - 50) * 0.5,
    )
    const res = { durationSec, score, level }
    setResult(res)
    onFinish(res)
  }

  function advanceStage(nextMoves: number) {
    const nextStage = stage + 1
    const levelNow = Math.min(10, startLevel + nextStage)
    peak.current = Math.max(peak.current, levelNow)
    if (nextStage >= 3 + Math.floor(startLevel / 4)) {
      finish(nextStage, nextMoves)
      return
    }
    setStage(nextStage)
    setDeck(buildDeck(pairsForStage(nextStage, startLevel)))
    setOpen([])
    setMoves(0)
    setLock(false)
  }

  function flip(id: number) {
    if (lock || result) return
    const card = deck.find((c) => c.id === id)
    if (!card || card.matched || open.includes(id)) return
    const nextOpen = [...open, id]
    setOpen(nextOpen)
    if (nextOpen.length < 2) return

    const nextMoves = moves + 1
    setMoves(nextMoves)
    const [a, b] = nextOpen
    const ca = deck.find((c) => c.id === a)!
    const cb = deck.find((c) => c.id === b)!
    if (ca.emoji === cb.emoji) {
      const next = deck.map((c) =>
        c.id === a || c.id === b ? { ...c, matched: true } : c,
      )
      setDeck(next)
      setOpen([])
      if (next.every((c) => c.matched)) {
        window.setTimeout(() => advanceStage(nextMoves), 380)
      }
    } else {
      setLock(true)
      window.setTimeout(() => {
        setOpen([])
        setLock(false)
      }, flipDelayMs(stage, startLevel))
    }
  }

  if (result) {
    return (
      <GameResultView
        result={result}
        label="Pares encontrados"
        onAgain={reset}
        onHub={onExit}
      />
    )
  }

  const cols = pairGoal >= 8 ? 4 : 3

  return (
    <GameFrame
      title="Pares de memória"
      hint={`Fase ${stage + 1} · nível ~${startLevel + stage} · ${matched}/${pairGoal} pares · ${moves} jogadas`}
    >
      <div className="jogos-pairs" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {deck.map((card) => {
          const shown = card.matched || open.includes(card.id)
          return (
            <button
              key={card.id}
              type="button"
              className={`jogos-pairs__card${shown ? ' is-open' : ''}${card.matched ? ' is-matched' : ''}`}
              onClick={() => flip(card.id)}
              disabled={lock || card.matched}
              aria-label={shown ? card.emoji : 'Carta tapada'}
            >
              <span>{shown ? card.emoji : '?'}</span>
            </button>
          )
        })}
      </div>
    </GameFrame>
  )
}
