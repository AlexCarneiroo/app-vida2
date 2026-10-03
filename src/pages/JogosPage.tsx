import { motion } from 'framer-motion'
import {
  Brain,
  Ear,
  Eye,
  Gamepad2,
  Hand,
  MessageCircle,
  Puzzle,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { ActivityHeatmap } from '../components/ui/ActivityHeatmap'
import {
  PageTransition,
  staggerContainer,
  staggerItem,
} from '../components/ui/PageTransition'
import { PageHeader } from '../components/ui/PageShell'
import { useToast } from '../components/ui/Feedback'
import { GameRouter } from '../components/jogos/GameRouter'
import {
  getGameDef,
  SKILL_LABELS,
  SKILL_ORDER,
} from '../data/jogosDefaults'
import { useJogos, type GameCard } from '../hooks/useJogos'
import { resolveStartLevel, type GameResult } from '../lib/jogosEngine'
import type { GameSkill } from '../types/jogos'

const SKILL_ICON: Record<GameSkill, typeof Brain> = {
  memoria: Brain,
  fala: MessageCircle,
  atencao: Eye,
  raciocinio: Puzzle,
  linguagem: Ear,
  coordenacao: Hand,
}

export function JogosPage() {
  const {
    playsToday,
    streak,
    totalMinutes,
    dayLog,
    cards,
    skillsTouched,
    recordPlay,
  } = useJogos()
  const { toast } = useToast()
  const [skillFilter, setSkillFilter] = useState<GameSkill | 'all'>('all')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [playKey, setPlayKey] = useState(0)
  const [sessionLevel, setSessionLevel] = useState(1)

  const active = activeId ? getGameDef(activeId) : null

  const filtered = useMemo(() => {
    if (skillFilter === 'all') return cards
    return cards.filter((c) => c.skill === skillFilter)
  }, [cards, skillFilter])

  function openGame(game: GameCard) {
    setActiveId(game.id)
    setSessionLevel(resolveStartLevel(game.bestLevel, game.bestScore))
    setPlayKey((k) => k + 1)
  }

  function closeGame() {
    setActiveId(null)
  }

  function handleFinish(result: GameResult) {
    if (!activeId) return
    recordPlay({
      gameId: activeId,
      durationSec: result.durationSec,
      score: result.score,
      level: result.level,
    })
    toast(`+${result.score} pts · nível ${result.level}`, 'ok')
  }

  if (active) {
    return (
      <PageTransition>
        <PageHeader
          kicker={SKILL_LABELS[active.skill]}
          title={active.title}
          sub={`${active.blurb} · começa no nível ${sessionLevel}`}
          onBack={closeGame}
        />
        <GameRouter
          key={`${active.id}-${playKey}`}
          game={active}
          startLevel={sessionLevel}
          onFinish={handleFinish}
          onExit={closeGame}
        />
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <PageHeader
        kicker="Desenvolvimento"
        title="Jogos"
        sub="Treino cognitivo curto: memória, fala, atenção, raciocínio e mais."
      />

      <div className="jogos-home">
        <section className="surface jogos-hero">
          <span className="jogos-hero__icon" aria-hidden>
            <Gamepad2 size={22} />
          </span>
          <div>
            <p className="page-kicker">Hub de treino mental</p>
            <strong>Pratica um pouco todos os dias</strong>
            <p>
              A dificuldade sobe ao concluíres rondas — e a próxima sessão
              começa no teu melhor nível.
            </p>
          </div>
        </section>

        <motion.div
          className="jogos-stats"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          <StatChip label="Hoje" value={String(playsToday)} />
          <StatChip label="Sequência" value={`${streak}d`} />
          <StatChip
            label="Minutos"
            value={totalMinutes > 0 ? String(Math.round(totalMinutes)) : '—'}
          />
          <StatChip
            label="Áreas"
            value={
              skillsTouched.length > 0 ? String(skillsTouched.length) : '—'
            }
          />
        </motion.div>

        <div className="jogos-filters" role="tablist" aria-label="Área">
          <FilterChip
            active={skillFilter === 'all'}
            onClick={() => setSkillFilter('all')}
          >
            Todas
          </FilterChip>
          {SKILL_ORDER.map((sk) => (
            <FilterChip
              key={sk}
              active={skillFilter === sk}
              onClick={() => setSkillFilter(sk)}
            >
              {SKILL_LABELS[sk]}
            </FilterChip>
          ))}
        </div>

        <motion.div
          className="jogos-grid"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {filtered.map((game) => (
            <GameTile key={game.id} game={game} onOpen={openGame} />
          ))}
        </motion.div>

        <ActivityHeatmap
          log={dayLog}
          range="month"
          title="Sessões do mês"
        />
      </div>
    </PageTransition>
  )
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <motion.div className="surface jogos-stat" variants={staggerItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </motion.div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`jogos-filter${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function GameTile({
  game,
  onOpen,
}: {
  game: GameCard
  onOpen: (g: GameCard) => void
}) {
  const Icon = SKILL_ICON[game.skill]
  return (
    <motion.button
      type="button"
      className="surface jogos-card"
      variants={staggerItem}
      onClick={() => onOpen(game)}
    >
      <span className="jogos-card__icon" aria-hidden>
        <Icon size={18} />
      </span>
      <div className="jogos-card__body">
        <strong>{game.title}</strong>
        <span>{game.blurb}</span>
        <em>
          {SKILL_LABELS[game.skill]}
          {game.plays > 0
            ? ` · ${game.plays}× · nv. ${Math.max(1, game.bestLevel)} · ${game.bestScore} pts`
            : ' · Jogar'}
        </em>
      </div>
    </motion.button>
  )
}
