import { useMemo, useRef, useState } from 'react'
import {
  clampScore,
  elapsedSec,
  pickOne,
  shuffle,
  type GameResult,
} from '../../lib/jogosEngine'
import { Button } from '../ui/Button'
import { GameFrame, GameResultView, type PlayProps } from './GameFrame'

const EASY = [
  'água fresca',
  'treino leve',
  'fala claro',
  'respira fundo',
  'mente calma',
]

const MEDIUM = [
  'água fresca pela manhã',
  'treino leve e constante',
  'respira fundo e fala claro',
  'cada sílaba no seu tempo',
  'mente calma corpo ativo',
  'ler em voz alta ajuda',
]

const HARD = [
  'articula bem as palavras sem pressa',
  'ritmo suave melhora a fluência da fala',
  'repete a frase com clareza e confiança',
  'prática diária fortalece a memória verbal',
  'concentra-te no som de cada sílaba',
]

function bankFor(level: number) {
  if (level >= 7) return [...MEDIUM, ...HARD]
  if (level >= 4) return [...EASY, ...MEDIUM]
  return EASY
}

function roundsFor(level: number) {
  return Math.min(10, 5 + Math.floor(level / 2))
}

function speak(text: string, rate: number) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'pt-BR'
  u.rate = rate
  window.speechSynthesis.speak(u)
}

export function FalaEco({ onFinish, onExit, startLevel }: PlayProps) {
  const started = useRef(Date.now())
  const peak = useRef(startLevel)
  const totalRounds = roundsFor(startLevel)
  const [round, setRound] = useState(0)
  const [levelNow, setLevelNow] = useState(startLevel)
  const [phrase, setPhrase] = useState(() => pickOne(bankFor(startLevel)))
  const [picked, setPicked] = useState<string[]>([])
  const [usedIdx, setUsedIdx] = useState<number[]>([])
  const [wrong, setWrong] = useState(0)
  const [result, setResult] = useState<GameResult | null>(null)

  const words = useMemo(() => phrase.split(/\s+/), [phrase])
  const pool = useMemo(() => shuffle(words.map((w, i) => ({ w, i }))), [words])
  const rate = Math.max(0.75, 1.05 - levelNow * 0.03)

  function reset() {
    const lv = Math.max(startLevel, peak.current)
    started.current = Date.now()
    setRound(0)
    setLevelNow(lv)
    setPhrase(pickOne(bankFor(lv)))
    setPicked([])
    setUsedIdx([])
    setWrong(0)
    setResult(null)
  }

  function nextPhrase(nextRound: number, nextWrong: number) {
    if (nextRound >= totalRounds) {
      const durationSec = elapsedSec(started.current)
      const level = Math.min(10, Math.max(startLevel, levelNow))
      peak.current = Math.max(peak.current, level)
      const score = clampScore(100 - nextWrong * 8 + startLevel)
      const res = { durationSec, score, level }
      setResult(res)
      onFinish(res)
      return
    }
    const lv = Math.min(10, startLevel + Math.floor(nextRound / 2))
    setLevelNow(lv)
    peak.current = Math.max(peak.current, lv)
    setRound(nextRound)
    setPhrase(pickOne(bankFor(lv)))
    setPicked([])
    setUsedIdx([])
  }

  function choose(word: string, poolKey: number) {
    if (result || usedIdx.includes(poolKey)) return
    const expect = words[picked.length]
    if (word !== expect) {
      setWrong((w) => w + 1)
      setPicked([])
      setUsedIdx([])
      return
    }
    const next = [...picked, word]
    setPicked(next)
    setUsedIdx([...usedIdx, poolKey])
    if (next.length === words.length) {
      window.setTimeout(() => nextPhrase(round + 1, wrong), 320)
    }
  }

  if (result) {
    return (
      <GameResultView
        result={result}
        label="Eco falado"
        onAgain={reset}
        onHub={onExit}
      />
    )
  }

  return (
    <GameFrame
      title="Eco falado"
      hint={`Ronda ${round + 1}/${totalRounds} · dificuldade ${levelNow} · ouve, articula e reconstrói`}
      footer={
        <Button variant="ghost" onClick={() => speak(phrase, rate)}>
          Ouvir frase
        </Button>
      }
    >
      <p className="jogos-eco__prompt" aria-live="polite">
        {picked.length === 0 ? '···' : picked.join(' ')}
      </p>
      <div className="jogos-eco__pool">
        {pool.map((item) => (
          <button
            key={item.i}
            type="button"
            className={`jogos-eco__chip${usedIdx.includes(item.i) ? ' is-used' : ''}`}
            disabled={usedIdx.includes(item.i)}
            onClick={() => choose(item.w, item.i)}
          >
            {item.w}
          </button>
        ))}
      </div>
      <p className="jogos-eco__tip">
        As frases ficam mais longas e o áudio mais rápido à medida que avances.
      </p>
    </GameFrame>
  )
}
