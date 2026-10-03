import type { ReactNode } from 'react'
import { Button } from '../ui/Button'
import type { GameResult } from '../../lib/jogosEngine'

type FrameProps = {
  title: string
  hint: string
  children: ReactNode
  footer?: ReactNode
}

export function GameFrame({ title, hint, children, footer }: FrameProps) {
  return (
    <div className="jogos-play">
      <div className="jogos-play__head">
        <strong>{title}</strong>
        <p>{hint}</p>
      </div>
      <div className="jogos-play__body">{children}</div>
      {footer ? <div className="jogos-play__footer">{footer}</div> : null}
    </div>
  )
}

type ResultProps = {
  result: GameResult
  label?: string
  onAgain: () => void
  onHub: () => void
}

export function GameResultView({
  result,
  label = 'Sessão concluída',
  onAgain,
  onHub,
}: ResultProps) {
  return (
    <div className="surface jogos-result">
      <p className="page-kicker">Resultado</p>
      <strong>{label}</strong>
      <div className="jogos-result__stats">
        <div>
          <span>Pontos</span>
          <em>{result.score}</em>
        </div>
        <div>
          <span>Nível</span>
          <em>{result.level}</em>
        </div>
        <div>
          <span>Tempo</span>
          <em>{result.durationSec}s</em>
        </div>
      </div>
      <div className="jogos-result__actions">
        <Button variant="ghost" onClick={onHub}>
          Hub
        </Button>
        <Button variant="primary" onClick={onAgain}>
          Jogar outra vez
        </Button>
      </div>
    </div>
  )
}

export type PlayProps = {
  onFinish: (result: GameResult) => void
  onExit: () => void
  /** Dificuldade inicial (1–10), sobe com o progresso guardado. */
  startLevel: number
}
