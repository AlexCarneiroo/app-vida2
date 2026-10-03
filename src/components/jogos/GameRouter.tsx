import type { GameDef } from '../../data/jogosDefaults'
import type { GameResult } from '../../lib/jogosEngine'
import { AtencaoFoco } from './AtencaoFoco'
import { CoordenacaoToque } from './CoordenacaoToque'
import { FalaEco } from './FalaEco'
import { FalaRitmo } from './FalaRitmo'
import { LinguagemVocab } from './LinguagemVocab'
import { MemoriaPares } from './MemoriaPares'
import { MemoriaSequencia } from './MemoriaSequencia'
import { RaciocinioPadroes } from './RaciocinioPadroes'

type Props = {
  game: GameDef
  startLevel: number
  onFinish: (result: GameResult) => void
  onExit: () => void
}

export function GameRouter({ game, startLevel, onFinish, onExit }: Props) {
  const props = { onFinish, onExit, startLevel }
  switch (game.id) {
    case 'memoria-pares':
      return <MemoriaPares {...props} />
    case 'memoria-sequencia':
      return <MemoriaSequencia {...props} />
    case 'fala-eco':
      return <FalaEco {...props} />
    case 'fala-ritmo':
      return <FalaRitmo {...props} />
    case 'atencao-foco':
      return <AtencaoFoco {...props} />
    case 'raciocinio-padroes':
      return <RaciocinioPadroes {...props} />
    case 'linguagem-vocab':
      return <LinguagemVocab {...props} />
    case 'coordenacao-toque':
      return <CoordenacaoToque {...props} />
    default:
      return (
        <div className="surface jogos-wait">
          <div>
            <strong>Jogo ainda não ligado</strong>
            <span>{game.title}</span>
          </div>
        </div>
      )
  }
}
