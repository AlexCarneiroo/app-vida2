import type { MuscleGroup, WorkoutTemplate } from '../types/treino'
import { clonePresetPlan, getPresetById } from './planPresets'

export {
  DAY_LABELS,
  DAY_NAMES,
  PLAN_DAY_ORDER,
} from './dayLabels'

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
