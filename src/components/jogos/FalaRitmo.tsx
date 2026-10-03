import { useEffect, useRef, useState } from 'react'
import {
  clampScore,
  elapsedSec,
  pickOne,
  scaleByLevel,
  type GameResult,
} from '../../lib/jogosEngine'
import { Button } from '../ui/Button'
import { GameFrame, GameResultView, type PlayProps } from './GameFrame'

const SHORT = [
  { word: 'ca-sa', beats: ['ca', 'sa'] },
  { word: 'fo-co', beats: ['fo', 'co'] },
  { word: 'luz', beats: ['luz'] },
]

const MID = [
  { word: 'me-mó-ria', beats: ['me', 'mó', 'ria'] },
  { word: 'a-ten-ção', beats: ['a', 'ten', 'ção'] },
  { word: 'res-pi-rar', beats: ['res', 'pi', 'rar'] },
  { word: 'lin-gua-gem', beats: ['lin', 'gua', 'gem'] },
  { word: 'con-stan-te', beats: ['con', 'stan', 'te'] },
]

const LONG = [
  { word: 'e-ner-gi-a', beats: ['e', 'ner', 'gi', 'a'] },
  { word: 'con-cen-tra-ção', beats: ['con', 'cen', 'tra', 'ção'] },
  { word: 'ar-ti-cu-la-ção', beats: ['ar', 'ti', 'cu', 'la', 'ção'] },
]

function poolFor(level: number) {
  if (level >= 7) return [...MID, ...LONG]
  if (level >= 4) return [...SHORT, ...MID]
  return SHORT
}

export function FalaRitmo({ onFinish, onExit, startLevel }: PlayProps) {
  const started = useRef(Date.now())
  const peak = useRef(startLevel)
  const totalRounds = Math.min(12, 6 + startLevel)
  const [round, setRound] = useState(0)
  const [levelNow, setLevelNow] = useState(startLevel)
  const [item, setItem] = useState(() => pickOne(poolFor(startLevel)))
  const [beat, setBeat] = useState(0)
  const [pulse, setPulse] = useState(false)
  const [hits, setHits] = useState(0)
  const [miss, setMiss] = useState(0)
  const [awaiting, setAwaiting] = useState(false)
  const [result, setResult] = useState<GameResult | null>(null)
  const windowRef = useRef<{ from: number; to: number } | null>(null)

  const bpm = Math.round(scaleByLevel(levelNow, 78, 130))
  const windowPad = Math.round(scaleByLevel(levelNow, 200, 110))

  function reset() {
    const lv = Math.max(startLevel, peak.current)
    started.current = Date.now()
    setRound(0)
    setLevelNow(lv)
    setItem(pickOne(poolFor(lv)))
    setBeat(0)
    setPulse(false)
    setHits(0)
    setMiss(0)
    setAwaiting(false)
    setResult(null)
  }

  useEffect(() => {
    if (result) return
    let cancelled = false
    const interval = Math.round(60000 / bpm)
    const id = window.setInterval(() => {
      if (cancelled) return
      setPulse(true)
      const now = Date.now()
      windowRef.current = { from: now - windowPad, to: now + windowPad }
      setAwaiting(true)
      window.setTimeout(() => {
        if (cancelled) return
        setPulse(false)
        setAwaiting(false)
      }, 160)
    }, interval)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [result, item, beat, bpm, windowPad])

  function finish(h: number, m: number) {
    const durationSec = elapsedSec(started.current)
    const level = Math.min(10, Math.max(startLevel, levelNow))
    peak.current = Math.max(peak.current, level)
    const total = h + m
    const score = clampScore(total === 0 ? 0 : (h / total) * 100)
    const res = { durationSec, score, level }
    setResult(res)
    onFinish(res)
  }

  function tap() {
    if (result) return
    const now = Date.now()
    const win = windowRef.current
    const ok = win && now >= win.from && now <= win.to
    if (ok) {
      const nextHits = hits + 1
      setHits(nextHits)
      const nextBeat = beat + 1
      if (nextBeat >= item.beats.length) {
        const nextRound = round + 1
        if (nextRound >= totalRounds) {
          finish(nextHits, miss)
          return
        }
        const lv = Math.min(10, startLevel + Math.floor(nextRound / 2))
        setLevelNow(lv)
        peak.current = Math.max(peak.current, lv)
        setRound(nextRound)
        setItem(pickOne(poolFor(lv)))
        setBeat(0)
      } else {
        setBeat(nextBeat)
      }
    } else {
      const nextMiss = miss + 1
      setMiss(nextMiss)
      if (nextMiss >= Math.max(5, 10 - Math.floor(startLevel / 2))) {
        finish(hits, nextMiss)
      }
    }
  }

  if (result) {
    return (
      <GameResultView
        result={result}
        label="Ritmo da fala"
        onAgain={reset}
        onHub={onExit}
      />
    )
  }

  return (
    <GameFrame
      title="Ritmo da fala"
      hint={`Ronda ${round + 1}/${totalRounds} · ${bpm} BPM · dificuldade ${levelNow}`}
    >
      <p className="jogos-ritmo__word">
        {item.beats.map((s, i) => (
          <span key={`${s}-${i}`} className={i === beat ? 'is-now' : ''}>
            {s}
          </span>
        ))}
      </p>
      <button
        type="button"
        className={`jogos-ritmo__pad${pulse ? ' is-pulse' : ''}`}
        onClick={tap}
        aria-label="Tocar no ritmo"
      >
        {awaiting ? 'Agora' : 'Espera'}
      </button>
      <p className="jogos-eco__tip">
        Acertos {hits} · Falhas {miss} — o pulso acelera e a janela aperta.
      </p>
      <Button variant="ghost" onClick={() => finish(hits, miss)}>
        Terminar
      </Button>
    </GameFrame>
  )
}
