import type { MuscleGroup, WorkoutTemplate } from '../types/treino'
import { clonePresetPlan, getPresetById } from './planPresets'

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'peito',
  'costas',
  'ombros',
  'bíceps',
  'tríceps',
  'pernas',
  'core',
  'cardio',
  'mobilidade',
]

export function clonePlan(plan: WorkoutTemplate[]): WorkoutTemplate[] {
  return JSON.parse(JSON.stringify(plan)) as WorkoutTemplate[]
}

/** Plano padrão = Push/Pull/Legs do catálogo */
export const WEEKLY_PLAN: WorkoutTemplate[] = clonePresetPlan(
  getPresetById('ppl-classic')!,
)

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
