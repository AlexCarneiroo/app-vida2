export type DailyCoachTone = 'ready' | 'attention' | 'recover'

export type DailyCoachSignal = {
  id: 'sleep' | 'water' | 'energy' | 'nutrition'
  label: string
  value: string
  status: 'ok' | 'warn' | 'unknown'
}

export type DailyCoachAction = {
  id: string
  text: string
  to: '/saude' | '/nutricao' | '/treino' | '/habitos'
  cta: string
}

export type DailyCoachReport = {
  score: number
  tone: DailyCoachTone
  title: string
  summary: string
  signals: DailyCoachSignal[]
  actions: DailyCoachAction[]
}

export type DailyCoachInput = {
  hour: number
  sleepHours: number | null
  sleepDebtHours: number
  waterMl: number
  waterGoalMl: number
  kcal: number
  kcalGoal: number
  protein: number
  proteinGoal: number
  energy: number | null
  symptoms?: string
  workoutPlanned: boolean
  workoutActive: boolean
  workoutDone: boolean
  pendingHabits: number
}

const pct = (value: number, goal: number) =>
  goal > 0 ? Math.max(0, Math.min(1, value / goal)) : 0

const formatHours = (hours: number) =>
  Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1).replace('.', ',')}h`

/**
 * Cruza os módulos do VIDA e produz uma orientação curta para o dia.
 * É uma recomendação de bem-estar, não um diagnóstico médico.
 */
export function buildDailyCoach(input: DailyCoachInput): DailyCoachReport {
  let score = 100
  const actions: DailyCoachAction[] = []
  const sleepKnown = input.sleepHours !== null
  const waterProgress = pct(input.waterMl, input.waterGoalMl)
  const expectedWaterProgress = Math.max(
    0,
    Math.min(1, (input.hour - 7) / 14),
  )
  const nutritionProgress = pct(input.kcal, input.kcalGoal)
  const proteinProgress = pct(input.protein, input.proteinGoal)
  const hasSymptoms = Boolean(input.symptoms?.trim())

  if (input.sleepHours !== null) {
    if (input.sleepHours < 5.5) score -= 42
    else if (input.sleepHours < 6.5) score -= 30
    else if (input.sleepHours < 7) score -= 14
  }
  if (input.sleepDebtHours >= 4) score -= 12
  else if (input.sleepDebtHours >= 2) score -= 6

  if (input.energy !== null) {
    if (input.energy <= 1) score -= 35
    else if (input.energy <= 2) score -= 24
    else if (input.energy === 3) score -= 8
  }
  if (hasSymptoms) score -= 35

  const waterBehind =
    input.hour >= 10 &&
    input.waterGoalMl > 0 &&
    waterProgress < Math.max(0.15, expectedWaterProgress * 0.6)
  if (waterBehind) score -= input.waterMl <= 0 ? 20 : 12

  const nutritionBehind =
    input.hour >= 12 &&
    input.kcalGoal > 0 &&
    nutritionProgress < Math.max(0.12, ((input.hour - 7) / 14) * 0.45)
  if (nutritionBehind) score -= 8

  score = Math.max(0, Math.min(100, Math.round(score)))

  if (hasSymptoms) {
    actions.push({
      id: 'symptoms',
      text: 'Registaste sintomas hoje. Evita forçar; se estiveres mal ou piorares, pausa e procura orientação profissional.',
      to: '/saude',
      cta: 'Ver saúde',
    })
  }

  if (input.sleepHours !== null && input.sleepHours < 6.5) {
    actions.push({
      id: 'sleep-training',
      text: input.workoutPlanned || input.workoutActive
        ? `Dormiste ${formatHours(input.sleepHours)}. Faz um treino leve, reduz a carga ou o volume e prioriza a técnica.`
        : `Dormiste ${formatHours(input.sleepHours)}. Hoje vale priorizar recuperação e uma noite mais cedo.`,
      to: input.workoutPlanned || input.workoutActive ? '/treino' : '/saude',
      cta: input.workoutPlanned || input.workoutActive ? 'Ver treino' : 'Ver sono',
    })
  } else if (!sleepKnown) {
    actions.push({
      id: 'sleep-missing',
      text: 'Regista o sono de ontem para o VIDA ajustar melhor a intensidade do treino.',
      to: '/saude',
      cta: 'Registar sono',
    })
  }

  if (waterBehind) {
    const workoutToday = input.workoutPlanned || input.workoutActive
    actions.push({
      id: 'water',
      text:
        input.waterMl <= 0
          ? workoutToday
            ? 'Ainda não há água registada hoje. Bebe água antes de treinar e vai completando a meta ao longo do dia.'
            : 'Ainda não há água registada hoje. Começa com um copo e vai completando a meta ao longo do dia.'
          : workoutToday
            ? `Água em ${Math.round(waterProgress * 100)}% da meta. Hidrata-te antes do treino e mantém a garrafa por perto.`
            : `Água em ${Math.round(waterProgress * 100)}% da meta. Mantém a garrafa por perto e recupera o ritmo.`,
      to: '/nutricao',
      cta: 'Registar água',
    })
  }

  if (nutritionBehind && (input.workoutPlanned || input.workoutActive)) {
    actions.push({
      id: 'fuel',
      text: 'A alimentação registada está baixa para este horário. Evita começar o treino sem energia.',
      to: '/nutricao',
      cta: 'Ver alimentação',
    })
  } else if (
    input.hour >= 14 &&
    input.proteinGoal > 0 &&
    proteinProgress < 0.35
  ) {
    actions.push({
      id: 'protein',
      text: `Proteína em ${Math.round(proteinProgress * 100)}% da meta. Inclui uma fonte de proteína na próxima refeição.`,
      to: '/nutricao',
      cta: 'Ver nutrição',
    })
  }

  if (actions.length === 0 && input.pendingHabits > 0) {
    actions.push({
      id: 'habits',
      text: `O corpo está em bom ritmo. Tens ${input.pendingHabits} hábito${input.pendingHabits > 1 ? 's' : ''} pendente${input.pendingHabits > 1 ? 's' : ''} para fechar o dia.`,
      to: '/habitos',
      cta: 'Ver hábitos',
    })
  }

  const tone: DailyCoachTone =
    score < 48 || hasSymptoms ? 'recover' : score < 76 ? 'attention' : 'ready'

  const title =
    tone === 'recover'
      ? input.workoutDone
        ? 'Hoje pede recuperação'
        : 'Treino leve hoje'
      : tone === 'attention'
        ? 'Ajusta o ritmo hoje'
        : 'Bom dia para avançar'

  const facts: string[] = []
  if (sleepKnown) facts.push(`sono de ${formatHours(input.sleepHours!)}`)
  if (waterBehind) facts.push('hidratação abaixo do ritmo')
  if (input.energy !== null && input.energy <= 2) facts.push('energia baixa')
  if (hasSymptoms) facts.push('sintomas registados')

  const summary =
    facts.length > 0
      ? `O VIDA cruzou ${facts.join(', ')} para orientar o teu dia.`
      : input.workoutDone
        ? 'Treino concluído; mantém água, alimentação e recuperação em dia.'
        : 'Sono, hidratação, energia e alimentação estão sem alertas importantes agora.'

  const signals: DailyCoachSignal[] = [
    {
      id: 'sleep',
      label: 'Sono',
      value: sleepKnown ? formatHours(input.sleepHours!) : 'Sem registo',
      status: !sleepKnown
        ? 'unknown'
        : input.sleepHours! >= 7
          ? 'ok'
          : 'warn',
    },
    {
      id: 'water',
      label: 'Água',
      value:
        input.waterGoalMl > 0
          ? `${input.waterMl}/${input.waterGoalMl} ml`
          : `${input.waterMl} ml`,
      status: waterBehind ? 'warn' : input.waterMl > 0 ? 'ok' : 'unknown',
    },
    {
      id: 'energy',
      label: 'Energia',
      value: input.energy !== null ? `${input.energy}/5` : 'Sem check-in',
      status:
        input.energy === null
          ? 'unknown'
          : input.energy >= 3
            ? 'ok'
            : 'warn',
    },
    {
      id: 'nutrition',
      label: 'Alimentação',
      value: input.kcal > 0 ? `${Math.round(input.kcal)} kcal` : 'Sem registo',
      status: nutritionBehind ? 'warn' : input.kcal > 0 ? 'ok' : 'unknown',
    },
  ]

  return {
    score,
    tone,
    title,
    summary,
    signals,
    actions: actions.slice(0, 3),
  }
}
