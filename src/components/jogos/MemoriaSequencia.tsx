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

const PADS = [
  { id: 0, className: 'is-a', label: 'A' },
  { id: 1, className: 'is-b', label: 'B' },
  { id: 2, className: 'is-c', label: 'C' },
  { id: 3, className: 'is-d', label: 'D' },
] as const

type Phase = 'ready' | 'show' | 'input' | 'done'

export function MemoriaSequencia({
  onFinish,
  onExit,
  startLevel,
}: PlayProps) {
  const started = useRef(Date.now())
  const peak = useRef(startLevel)
  const [phase, setPhase] = useState<Phase>('ready')
  const [seq, setSeq] = useState<number[]>([])
  const [step, setStep] = useState(0)
  const [lit, setLit] = useState<number | null>(null)
  const [level, setLevel] = useState(0)
  const [result, setResult] = useState<GameResult | null>(null)

  const maxLen = Math.min(16, 8 + startLevel)
  const onMs = () => Math.round(scaleByLevel(startLevel + level, 520, 260))
  const gapMs = () => Math.round(scaleByLevel(startLevel + level, 240, 110))

  function seedSeq() {
    const len = Math.min(maxLen, Math.max(1, Math.ceil(startLevel / 3)))
    return Array.from({ length: len }, () => pickOne([0, 1, 2, 3]))
  }

  function reset() {
    started.current = Date.now()
    setPhase('ready')
    setSeq([])
    setStep(0)
    setLit(null)
    setLevel(0)
    setResult(null)
  }

  function startRound(base: number[] = []) {
    const next =
      base.length === 0 ? seedSeq() : [...base, pickOne([0, 1, 2, 3])]
    setSeq(next)
    setStep(0)
    setPhase('show')
  }

  useEffect(() => {
    if (phase !== 'show' || seq.length === 0) return
    let i = 0
    let cancelled = false
    const litFor = onMs()
    const gap = gapMs()
    const run = () => {
      if (cancelled) return
      if (i >= seq.length) {
        setLit(null)
        setPhase('input')
        return
      }
      setLit(seq[i]!)
      window.setTimeout(() => {
        if (cancelled) return
        setLit(null)
        i += 1
        window.setTimeout(run, gap)
      }, litFor)
    }
    const t = window.setTimeout(run, 300)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [phase, seq])

  function fail(reached: number) {
    const durationSec = elapsedSec(started.current)
    const levelOut = Math.min(10, Math.max(startLevel, reached))
    peak.current = Math.max(peak.current, levelOut)
    const score = clampScore(reached * 10 + startLevel * 2)
    const res = { durationSec, score, level: levelOut }
    setResult(res)
    setPhase('done')
    onFinish(res)
  }

  function tap(id: number) {
    if (phase !== 'input') return
    if (seq[step] !== id) {
      fail(level)
      return
    }
    const nextStep = step + 1
    if (nextStep >= seq.length) {
      const reached = seq.length
      setLevel(reached)
      peak.current = Math.max(peak.current, Math.min(10, startLevel + reached))
      if (reached >= maxLen) {
        const durationSec = elapsedSec(started.current)
        const res = {
          durationSec,
          score: clampScore(88 + reached + startLevel),
          level: Math.min(10, startLevel + reached),
        }
        setResult(res)
        setPhase('done')
        onFinish(res)
        return
      }
      window.setTimeout(() => startRound(seq), 420)
      return
    }
    setStep(nextStep)
  }

  if (result) {
    return (
      <GameResultView
        result={result}
        label="Sequência"
        onAgain={reset}
        onHub={onExit}
      />
    )
  }

  return (
    <GameFrame
      title="Sequência"
      hint={
        phase === 'ready'
          ? `Começa no nível ${startLevel} — a sequência cresce e fica mais rápida.`
          : phase === 'show'
            ? `Observa… (${seq.length} passos)`
            : `Nível ${level || seq.length} · a tua vez`
      }
      footer={
        phase === 'ready' ? (
          <Button variant="primary" onClick={() => startRound([])}>
            Começar
          </Button>
        ) : null
      }
    >
      <div className="jogos-simon">
        {PADS.map((pad) => (
          <button
            key={pad.id}
            type="button"
            className={`jogos-simon__pad ${pad.className}${lit === pad.id ? ' is-lit' : ''}`}
            onClick={() => tap(pad.id)}
            disabled={phase !== 'input'}
          >
            {pad.label}
          </button>
        ))}
      </div>
    </GameFrame>
  )
}
