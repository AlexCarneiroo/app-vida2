/** Labels de dia da semana — ficheiro leve (sem planos/presets). */

export const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

export const DAY_NAMES = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const

/** Ordem de montagem do plano: Seg → Dom */
export const PLAN_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const
