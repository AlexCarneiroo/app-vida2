import { dateKey, uid } from '../lib/date'
import type {
  GameBest,
  GameSession,
  GameSkill,
  GameStatus,
  JogosState,
} from '../types/jogos'

/** Definição estática de um jogo (catálogo). */
export type GameDef = {
  id: string
  title: string
  blurb: string
  skill: GameSkill
  status: GameStatus
  /** Minutos sugeridos por sessão. */
  minutesHint: number
}

export const SKILL_LABELS: Record<GameSkill, string> = {
  memoria: 'Memória',
  fala: 'Fala',
  atencao: 'Atenção',
  raciocinio: 'Raciocínio',
  linguagem: 'Linguagem',
  coordenacao: 'Coordenação',
}

export const SKILL_ORDER: GameSkill[] = [
  'memoria',
  'fala',
  'atencao',
  'raciocinio',
  'linguagem',
  'coordenacao',
]

/** Catálogo jogável — treino cognitivo (memória, fala, atenção…). */
export const GAME_CATALOG: GameDef[] = [
  {
    id: 'memoria-pares',
    title: 'Pares de memória',
    blurb: 'Encontra pares e treina a memória de curto prazo.',
    skill: 'memoria',
    status: 'available',
    minutesHint: 5,
  },
  {
    id: 'memoria-sequencia',
    title: 'Sequência',
    blurb: 'Repete padrões crescentes — foco e memória de trabalho.',
    skill: 'memoria',
    status: 'available',
    minutesHint: 4,
  },
  {
    id: 'fala-eco',
    title: 'Eco falado',
    blurb: 'Ouve, articula e reconstrói a frase na ordem certa.',
    skill: 'fala',
    status: 'available',
    minutesHint: 5,
  },
  {
    id: 'fala-ritmo',
    title: 'Ritmo da fala',
    blurb: 'Sincroniza sílabas com um pulso — fluência e controlo.',
    skill: 'fala',
    status: 'available',
    minutesHint: 4,
  },
  {
    id: 'atencao-foco',
    title: 'Foco rápido',
    blurb: 'Deteta o alvo certo entre distratores.',
    skill: 'atencao',
    status: 'available',
    minutesHint: 3,
  },
  {
    id: 'raciocinio-padroes',
    title: 'Padrões',
    blurb: 'Completa sequências lógicas e relações.',
    skill: 'raciocinio',
    status: 'available',
    minutesHint: 6,
  },
  {
    id: 'linguagem-vocab',
    title: 'Vocabulário',
    blurb: 'Associa palavras, categorias e significados.',
    skill: 'linguagem',
    status: 'available',
    minutesHint: 5,
  },
  {
    id: 'coordenacao-toque',
    title: 'Toque certeiro',
    blurb: 'Precisão e tempo de reação com toques guiados.',
    skill: 'coordenacao',
    status: 'available',
    minutesHint: 3,
  },
]

export const emptyJogosState = (): JogosState => ({
  dayLog: {},
  sessions: [],
  bestByGame: [],
  totalMinutes: 0,
})

export function getGameDef(id: string): GameDef | undefined {
  return GAME_CATALOG.find((g) => g.id === id)
}

export function createSession(input: {
  gameId: string
  durationSec: number
  score?: number
  level?: number
  dateKey?: string
}): GameSession {
  return {
    id: uid('play'),
    gameId: input.gameId,
    dateKey: input.dateKey || dateKey(),
    durationSec: Math.max(0, Math.round(input.durationSec)),
    score:
      input.score !== undefined && Number.isFinite(input.score)
        ? Math.round(input.score)
        : undefined,
    level:
      input.level !== undefined && Number.isFinite(input.level)
        ? Math.max(1, Math.round(input.level))
        : undefined,
    createdAt: new Date().toISOString(),
  }
}

export function applySession(
  state: JogosState,
  session: GameSession,
): JogosState {
  const sessions = [session, ...state.sessions].slice(0, 200)
  const dayLog = { ...state.dayLog }
  dayLog[session.dateKey] = (dayLog[session.dateKey] ?? 0) + 1

  const minutesAdd = session.durationSec / 60
  const totalMinutes =
    Math.round((state.totalMinutes + minutesAdd) * 10) / 10

  const prevBest = state.bestByGame.find((b) => b.gameId === session.gameId)
  const nextBest: GameBest = {
    gameId: session.gameId,
    bestScore: Math.max(prevBest?.bestScore ?? 0, session.score ?? 0),
    bestLevel: Math.max(prevBest?.bestLevel ?? 0, session.level ?? 0),
    plays: (prevBest?.plays ?? 0) + 1,
    lastPlayedAt: session.createdAt,
    lastDateKey: session.dateKey,
  }
  const bestByGame = [
    nextBest,
    ...state.bestByGame.filter((b) => b.gameId !== session.gameId),
  ]

  return {
    dayLog,
    sessions,
    bestByGame,
    totalMinutes,
  }
}

/** Dias seguidos com pelo menos 1 sessão (a partir de hoje). */
export function playStreak(
  dayLog: Record<string, number>,
  today = dateKey(),
): number {
  let streak = 0
  let cursor = today
  for (let i = 0; i < 366; i++) {
    if ((dayLog[cursor] ?? 0) <= 0) break
    streak += 1
    const [y, m, d] = cursor.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() - 1)
    const yy = dt.getFullYear()
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const dd = String(dt.getDate()).padStart(2, '0')
    cursor = `${yy}-${mm}-${dd}`
  }
  return streak
}
