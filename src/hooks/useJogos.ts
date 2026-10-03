import { useCallback, useMemo } from 'react'
import {
  applySession,
  createSession,
  emptyJogosState,
  GAME_CATALOG,
  playStreak,
  SKILL_ORDER,
  type GameDef,
} from '../data/jogosDefaults'
import { dateKey } from '../lib/date'
import { loadJogosPersisted } from '../lib/persist'
import type { GameSkill, JogosState } from '../types/jogos'
import { useCloudSyncedState } from './useCloudSyncedState'

const STORAGE_KEY = 'vida.jogos.v1'

function loadDoc() {
  return loadJogosPersisted(STORAGE_KEY, emptyJogosState())
}

const isEmpty = (d: JogosState) =>
  d.sessions.length === 0 &&
  d.bestByGame.length === 0 &&
  Object.keys(d.dayLog).length === 0

export type GameCard = GameDef & {
  plays: number
  bestScore: number
  bestLevel: number
  lastDateKey: string | null
}

export function useJogos() {
  const { state, update } = useCloudSyncedState<JogosState>({
    collection: 'jogos',
    storageKey: STORAGE_KEY,
    load: loadDoc,
    isEmpty,
  })

  const today = dateKey()
  const playsToday = state.dayLog[today] ?? 0
  const streak = useMemo(
    () => playStreak(state.dayLog, today),
    [state.dayLog, today],
  )

  const cards: GameCard[] = useMemo(
    () =>
      GAME_CATALOG.map((game) => {
        const best = state.bestByGame.find((b) => b.gameId === game.id)
        return {
          ...game,
          plays: best?.plays ?? 0,
          bestScore: best?.bestScore ?? 0,
          bestLevel: best?.bestLevel ?? 0,
          lastDateKey: best?.lastDateKey ?? null,
        }
      }),
    [state.bestByGame],
  )

  const skillsTouched = useMemo(() => {
    const set = new Set<GameSkill>()
    for (const s of state.sessions.slice(0, 40)) {
      const def = GAME_CATALOG.find((g) => g.id === s.gameId)
      if (def) set.add(def.skill)
    }
    return SKILL_ORDER.filter((sk) => set.has(sk))
  }, [state.sessions])

  const recordPlay = useCallback(
    (input: {
      gameId: string
      durationSec: number
      score?: number
      level?: number
    }) => {
      const session = createSession(input)
      update((prev) => applySession(prev, session))
      return session.id
    },
    [update],
  )

  return {
    state,
    today,
    playsToday,
    streak,
    totalMinutes: state.totalMinutes,
    dayLog: state.dayLog,
    cards,
    skillsTouched,
    recentSessions: state.sessions.slice(0, 12),
    recordPlay,
  }
}
