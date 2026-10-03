/** Utilitários partilhados pelos mini-jogos. */

export function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function clampScore(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function pickOne<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

export function pickN<T>(items: readonly T[], n: number): T[] {
  return shuffle([...items]).slice(0, Math.min(n, items.length))
}

export type GameResult = {
  durationSec: number
  score: number
  level: number
}

export function elapsedSec(startedAt: number) {
  return Math.max(1, Math.round((Date.now() - startedAt) / 1000))
}

/**
 * Nível de partida (1–10) a partir do histórico.
 * Se já chegaste longe / com boa pontuação, a próxima sessão começa mais dura.
 */
export function resolveStartLevel(bestLevel: number, bestScore: number) {
  const base = Math.max(1, Math.min(10, bestLevel || 1))
  const bump = bestScore >= 85 ? 1 : bestScore >= 70 ? 0 : 0
  return Math.min(10, base + bump)
}

/** Escala um valor: mais fácil no nível 1, mais duro no 10. */
export function scaleByLevel(
  level: number,
  easy: number,
  hard: number,
): number {
  const t = Math.max(0, Math.min(1, (Math.max(1, level) - 1) / 9))
  return easy + (hard - easy) * t
}
