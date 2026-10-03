import { Link } from 'react-router-dom'
import { DAY_LABELS, DAY_NAMES } from '../../data/dayLabels'
import type { WorkoutTemplate } from '../../types/treino'

export type InstructorHomeNoteData = {
  text: string
  href?: string
  cta?: string
}

const TIPS = [
  'Prioriza a técnica antes de subir a carga. Duas reps limpas valem mais que cinco com impulso.',
  'Se a série ficou leve, sobe 2,5 kg na próxima — progresso pequeno e constante.',
  'Descansa o suficiente entre séries compostas. Pressa barata o estímulo.',
  'Água e sono são parte do treino. Sem isso, a carga não rende.',
  'Aquecimento curto: 1–2 séries leves do primeiro exercício e seguimos.',
  'Se falhaste um dia, recupera um treino — não tentes fazer a semana toda de uma vez.',
  'Anota a carga. Memória falha; o histórico não.',
  'Cardio leve nos dias de folga ajuda a recuperar sem roubar força.',
  'Última série: para 1–2 reps antes da falha. Assim amanhã ainda há treino.',
  'Ombros e joelhos agradecem amplitude controlada. Não force o ego.',
]

function tipForDay(seed: string) {
  const n = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return TIPS[n % TIPS.length]
}

/** Recado curto para a aba Início (estilo mensagem do dia). */
export function buildInstructorHomeNote(input: {
  dateKey: string
  firstName?: string | null
  todayTemplate: WorkoutTemplate | null
  todayDone: boolean
  missed: WorkoutTemplate[]
  activeName?: string | null
}): InstructorHomeNoteData {
  const you = (input.firstName ?? '').trim().split(/\s+/)[0] || null

  if (input.activeName) {
    return {
      text: `${you ? `${you}, ` : ''}tens «${input.activeName}» a meio. Vale a pena fechar a sessão.`,
      href: '/treino',
      cta: 'Continuar',
    }
  }

  if (input.missed.length > 0) {
    const oldest = input.missed[0]
    const label = `${DAY_LABELS[oldest.dayOfWeek]} · ${oldest.name}`
    if (input.missed.length === 1) {
      return {
        text: input.todayDone
          ? `Hoje cumpriste. Ainda falta recuperar ${DAY_NAMES[oldest.dayOfWeek]} (${oldest.name}).`
          : `Tens 1 treino em atraso: ${label}. Recupera quando puderes.`,
        href: '/treino',
        cta: 'Ver atraso',
      }
    }
    return {
      text: `Tens ${input.missed.length} treinos em atraso (ex.: ${label}). Não deixes acumular.`,
      href: '/treino',
      cta: 'Ver atrasos',
    }
  }

  if (input.todayTemplate && !input.todayDone) {
    return {
      text: `Hoje: ${input.todayTemplate.name} · ~${input.todayTemplate.estimatedMin} min. ${tipForDay(input.dateKey)}`,
      href: '/treino',
      cta: 'Treinar',
    }
  }

  if (input.todayDone) {
    return {
      text: `Sessão de hoje feita. ${tipForDay(input.dateKey + '-done')}`,
      href: '/treino',
      cta: 'Ver treino',
    }
  }

  return {
    text: tipForDay(input.dateKey),
    href: '/treino',
    cta: 'Treino',
  }
}

export function InstructorHomeNote({ data }: { data: InstructorHomeNoteData }) {
  return (
    <aside className="home-hero__quote home-instructor-note" aria-label="Instrutor">
      <p>{data.text}</p>
      <cite>
        <span>Instrutor</span>
        {data.href && data.cta ? (
          <Link to={data.href} className="home-instructor-note__cta">
            {data.cta}
          </Link>
        ) : null}
      </cite>
    </aside>
  )
}
