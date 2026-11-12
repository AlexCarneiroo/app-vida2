import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  Briefcase,
  CalendarDays,
  Dumbbell,
  Heart,
  Home,
  Leaf,
  Moon,
  Pin,
  RefreshCw,
  Sparkles,
  Star,
  Wallet,
} from 'lucide-react'

const BY_CATEGORY: Record<string, LucideIcon> = {
  trabalho: Briefcase,
  pessoal: Leaf,
  estudos: BookOpen,
  saude: Heart,
  treino: Dumbbell,
  familia: Home,
  financeiro: Wallet,
  lazer: Sparkles,
  reunioes: CalendarDays,
  descanso: Moon,
  outros: Pin,
  habito: Star,
  rotina: RefreshCw,
}

export function agendaIconFor(categoryId: string, source?: string): LucideIcon {
  if (source === 'treino') return Dumbbell
  if (source === 'habito') return Star
  if (source === 'rotina') return RefreshCw
  return BY_CATEGORY[categoryId] ?? Pin
}

export function AgendaIcon({
  categoryId,
  source,
  size = 14,
  className,
}: {
  categoryId: string
  source?: string
  size?: number
  className?: string
}) {
  const Icon = agendaIconFor(categoryId, source)
  return (
    <Icon
      className={className}
      size={size}
      strokeWidth={2.25}
      aria-hidden
    />
  )
}
