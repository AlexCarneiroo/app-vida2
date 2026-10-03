import { useMemo, useRef, useState } from 'react'
import {
  clampScore,
  elapsedSec,
  shuffle,
  type GameResult,
} from '../../lib/jogosEngine'
import { GameFrame, GameResultView, type PlayProps } from './GameFrame'

type Item = {
  question: string
  options: string[]
  answer: string
  hard?: boolean
}

const BANK: Item[] = [
  {
    question: 'Qual NÃO é uma fruta?',
    options: ['Maçã', 'Banana', 'Cenoura', 'Uva'],
    answer: 'Cenoura',
  },
  {
    question: 'Sinónimo de “rápido”?',
    options: ['Lento', 'Ágil', 'Pesado', 'Fraco'],
    answer: 'Ágil',
  },
  {
    question: 'Antónimo de “claro”?',
    options: ['Luminoso', 'Escuro', 'Aberto', 'Suave'],
    answer: 'Escuro',
  },
  {
    question: 'Qual palavra é um verbo?',
    options: ['Casa', 'Correr', 'Azul', 'Mesa'],
    answer: 'Correr',
  },
  {
    question: 'Completa: pão está para padaria como livro está para…',
    options: ['Praia', 'Biblioteca', 'Garagem', 'Jardim'],
    answer: 'Biblioteca',
  },
  {
    question: 'Qual NÃO é um animal?',
    options: ['Lobo', 'Águia', 'Pinheiro', 'Peixe'],
    answer: 'Pinheiro',
  },
  {
    question: 'Sinónimo de “feliz”?',
    options: ['Triste', 'Contente', 'Cansado', 'Frio'],
    answer: 'Contente',
  },
  {
    question: 'Qual é um adjetivo?',
    options: ['Andar', 'Bonito', 'Ontem', 'Casa'],
    answer: 'Bonito',
  },
  {
    question: 'Completa: médico está para hospital como professor está para…',
    options: ['Escola', 'Mercado', 'Estádio', 'Farmácia'],
    answer: 'Escola',
  },
  {
    question: 'Antónimo de “subir”?',
    options: ['Crescer', 'Descer', 'Voar', 'Seguir'],
    answer: 'Descer',
  },
  {
    question: 'Qual palavra está mal formada?',
    options: ['Criança', 'Pessôa', 'Amizade', 'Coragem'],
    answer: 'Pessôa',
    hard: true,
  },
  {
    question: 'Sinónimo de “efémero”?',
    options: ['Eterno', 'Passageiro', 'Pesado', 'Rígido'],
    answer: 'Passageiro',
    hard: true,
  },
  {
    question: 'Antónimo de “escasso”?',
    options: ['Raro', 'Abundante', 'Frágil', 'Opaco'],
    answer: 'Abundante',
    hard: true,
  },
  {
    question: 'Completa: causa está para efeito como pergunta está para…',
    options: ['Dúvida', 'Resposta', 'Silêncio', 'Tema'],
    answer: 'Resposta',
    hard: true,
  },
  {
    question: 'Qual NÃO é um substantivo abstrato?',
    options: ['Liberdade', 'Coragem', 'Cadeira', 'Amor'],
    answer: 'Cadeira',
    hard: true,
  },
]

function deal(startLevel: number): Item[] {
  const count = Math.min(12, 6 + Math.floor(startLevel / 2))
  const pool =
    startLevel >= 5
      ? BANK
      : startLevel >= 3
        ? BANK.filter((i) => !i.hard || Math.random() > 0.4)
        : BANK.filter((i) => !i.hard)
  return shuffle(pool)
    .slice(0, count)
    .map((item) => ({
      ...item,
      options: shuffle(item.options),
    }))
}

export function LinguagemVocab({
  onFinish,
  onExit,
  startLevel,
}: PlayProps) {
  const started = useRef(Date.now())
  const peak = useRef(startLevel)
  const [items, setItems] = useState(() => deal(startLevel))
  const [idx, setIdx] = useState(0)
  const [hits, setHits] = useState(0)
  const [result, setResult] = useState<GameResult | null>(null)
  const item = items[idx]!
  const levelNow = Math.min(10, startLevel + Math.floor(idx / 2))

  const progress = useMemo(
    () => `${idx + 1}/${items.length}`,
    [idx, items.length],
  )

  function reset() {
    const lv = Math.max(startLevel, peak.current)
    started.current = Date.now()
    setItems(deal(lv))
    setIdx(0)
    setHits(0)
    setResult(null)
  }

  function finish(h: number) {
    const durationSec = elapsedSec(started.current)
    const level = Math.min(10, Math.max(startLevel, levelNow))
    peak.current = Math.max(peak.current, level)
    const score = clampScore((h / items.length) * 100)
    const res = { durationSec, score, level }
    setResult(res)
    onFinish(res)
  }

  function choose(opt: string) {
    if (result) return
    const nextHits = hits + (opt === item.answer ? 1 : 0)
    if (opt === item.answer) setHits(nextHits)
    const next = idx + 1
    peak.current = Math.max(
      peak.current,
      Math.min(10, startLevel + Math.floor(next / 2)),
    )
    if (next >= items.length) {
      finish(nextHits)
      return
    }
    setIdx(next)
  }

  if (result) {
    return (
      <GameResultView
        result={result}
        label="Vocabulário"
        onAgain={reset}
        onHub={onExit}
      />
    )
  }

  return (
    <GameFrame
      title="Vocabulário"
      hint={`Pergunta ${progress} · dificuldade ${levelNow}`}
    >
      <p className="jogos-padrao__prompt">{item.question}</p>
      <div className="jogos-padrao__opts jogos-padrao__opts--wide">
        {item.options.map((opt) => (
          <button
            key={opt}
            type="button"
            className="jogos-padrao__opt"
            onClick={() => choose(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </GameFrame>
  )
}
