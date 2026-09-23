import { useEffect, useState } from 'react'
import { dateKey } from '../lib/date'

type Quote = {
  text: string
  author: string
}

const CACHE_KEY = 'vida.quote.v1'

const FALLBACK_QUOTES: Quote[] = [
  {
    text: 'Disciplina é o atalho mais honesto entre tu e o que queres.',
    author: 'VIDA',
  },
  {
    text: 'Não precisas de um dia perfeito. Precisas de um dia teu.',
    author: 'VIDA',
  },
  {
    text: 'O corpo ouve o que a mente repete. Escolhe bem as palavras.',
    author: 'VIDA',
  },
  {
    text: 'Constância vence talento que descansa.',
    author: 'VIDA',
  },
]

function pickFallback(seed: string) {
  const n = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return FALLBACK_QUOTES[n % FALLBACK_QUOTES.length]
}

function cacheKey(day: string) {
  return `${CACHE_KEY}.${day}`
}

async function translateToPt(text: string) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|pt-BR`
  const res = await fetch(url)
  if (!res.ok) throw new Error('translate')
  const data = (await res.json()) as {
    responseData?: { translatedText?: string }
  }
  const out = data.responseData?.translatedText?.trim()
  if (!out || out.toLowerCase() === text.toLowerCase()) return text
  return out
}

async function fetchRemoteQuote(): Promise<Quote> {
  const res = await fetch('https://dummyjson.com/quotes/random')
  if (!res.ok) throw new Error('quote')
  const data = (await res.json()) as { quote?: string; author?: string }
  const raw = (data.quote || '').trim()
  if (!raw) throw new Error('empty')
  let text = raw
  try {
    text = await translateToPt(raw)
  } catch {
    text = raw
  }
  return {
    text,
    author: (data.author || 'Anónimo').trim(),
  }
}

export function useMotivation() {
  const today = dateKey()
  const [quote, setQuote] = useState<Quote | null>(() => {
    try {
      const raw = localStorage.getItem(cacheKey(today))
      return raw ? (JSON.parse(raw) as Quote) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    let cancelled = false
    const cached = quote
    if (cached) return

    ;(async () => {
      try {
        const next = await fetchRemoteQuote()
        if (cancelled) return
        setQuote(next)
        localStorage.setItem(cacheKey(today), JSON.stringify(next))
      } catch {
        if (cancelled) return
        const next = pickFallback(today)
        setQuote(next)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [today, quote])

  return quote
}

export function coachLine(input: {
  hour: number
  firstName: string | null
  dayProgress: number
  dayTotal: number
  habitPending: boolean
  workoutPending: boolean
}) {
  const you = input.firstName || 'campeão'
  if (input.dayTotal === 0) {
    return `Hoje está em branco, ${you}. Um hábito ou um treino já muda o tom do dia.`
  }
  if (input.dayProgress >= 100) {
    return `Fechaste o dia, ${you}. Isto não é sorte — é ritmo.`
  }
  if (input.hour < 12 && input.habitPending) {
    return 'A manhã ainda está fria. Um check agora pesa mais do que dez à noite.'
  }
  if (input.workoutPending && input.hour >= 12 && input.hour < 19) {
    return 'O treino de hoje ainda te espera. Entra, mesmo que seja curto.'
  }
  if (input.hour >= 20 && input.dayProgress < 60) {
    return 'Ainda dá para um gesto pequeno. Água, um bloco, uma série — e o dia muda.'
  }
  if (input.dayProgress >= 60) {
    return `Já vais a ${input.dayProgress}%. Não soltes agora — o fecho é a parte boa.`
  }
  return 'Não precisas de fazer tudo. Precisas de não falhar o próximo passo.'
}
