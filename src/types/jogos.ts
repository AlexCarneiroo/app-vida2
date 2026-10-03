/** Capacidades cognitivas / de desenvolvimento. */
export type GameSkill =
  | 'memoria'
  | 'fala'
  | 'atencao'
  | 'raciocinio'
  | 'linguagem'
  | 'coordenacao'

export type GameStatus = 'soon' | 'available'

/** Sessão jogada (histórico). */
export type GameSession = {
  id: string
  gameId: string
  dateKey: string
  /** Duração em segundos. */
  durationSec: number
  /** Pontuação opcional (0–100 ou livre por jogo). */
  score?: number
  /** Nível / dificuldade registada. */
  level?: number
  createdAt: string
}

/** Melhor marca por jogo. */
export type GameBest = {
  gameId: string
  bestScore: number
  bestLevel: number
  plays: number
  lastPlayedAt: string
  lastDateKey: string
}

export type JogosState = {
  /** Contagem de sessões por dia (heatmap). */
  dayLog: Record<string, number>
  sessions: GameSession[]
  bestByGame: GameBest[]
  /** Minutos acumulados (arredondados). */
  totalMinutes: number
}
