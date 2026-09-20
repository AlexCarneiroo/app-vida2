import type { MuscleGroup, TemplateExercise, WorkoutTemplate } from '../types/treino'
import { defaultExerciseName, exercisesForMuscle } from './exerciseLibrary'
import { DAY_NAMES } from './treinoDefaults'

export const WORKOUT_STARTERS = [
  { id: 'custom', label: 'O meu treino', hint: 'Começa do zero' },
  { id: 'push', label: 'Push', hint: 'Peito · ombro · tríceps' },
  { id: 'pull', label: 'Pull', hint: 'Costas · bíceps' },
  { id: 'legs', label: 'Pernas', hint: 'Quadríceps · posterior' },
  { id: 'upper', label: 'Superior', hint: 'Peito · costas · ombro' },
  { id: 'lower', label: 'Inferior', hint: 'Pernas · glúteo' },
  { id: 'full', label: 'Full body', hint: 'Corpo inteiro' },
] as const

export type WorkoutStarterId = (typeof WORKOUT_STARTERS)[number]['id']

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

function exercise(
  muscle: MuscleGroup,
  name?: string,
  sets = [
    { reps: 10, weight: 20 },
    { reps: 10, weight: 20 },
    { reps: 10, weight: 20 },
  ],
): TemplateExercise {
  const list = exercisesForMuscle(muscle)
  return {
    id: makeId('ex'),
    name: name ?? list[0] ?? defaultExerciseName(muscle),
    muscle,
    sets: sets.map((s) => ({ ...s })),
  }
}

function buildExercises(starter: WorkoutStarterId): TemplateExercise[] {
  switch (starter) {
    case 'push':
      return [
        exercise('peito', 'Supino reto'),
        exercise('peito', 'Supino inclinado'),
        exercise('ombros', 'Desenvolvimento halteres'),
        exercise('ombros', 'Elevação lateral'),
        exercise('tríceps', 'Tríceps corda'),
      ]
    case 'pull':
      return [
        exercise('costas', 'Puxada frontal'),
        exercise('costas', 'Remada curvada'),
        exercise('costas', 'Remada unilateral'),
        exercise('bíceps', 'Rosca direta'),
        exercise('bíceps', 'Rosca martelo'),
      ]
    case 'legs':
      return [
        exercise('pernas', 'Agachamento livre'),
        exercise('pernas', 'Leg press'),
        exercise('pernas', 'Cadeira extensora'),
        exercise('pernas', 'Mesa flexora'),
        exercise('pernas', 'Panturrilha em pé'),
      ]
    case 'upper':
      return [
        exercise('peito', 'Supino reto'),
        exercise('costas', 'Puxada frontal'),
        exercise('ombros', 'Elevação lateral'),
        exercise('bíceps', 'Rosca direta'),
        exercise('tríceps', 'Tríceps corda'),
      ]
    case 'lower':
      return [
        exercise('pernas', 'Agachamento livre'),
        exercise('pernas', 'Stiff'),
        exercise('pernas', 'Leg press'),
        exercise('pernas', 'Elevação pélvica'),
        exercise('core', 'Prancha'),
      ]
    case 'full':
      return [
        exercise('peito', 'Supino reto'),
        exercise('costas', 'Remada curvada'),
        exercise('pernas', 'Agachamento goblet'),
        exercise('ombros', 'Desenvolvimento halteres'),
        exercise('core', 'Abdominal crunch'),
      ]
    case 'custom':
    default:
      return [exercise('peito')]
  }
}

const STARTER_META: Record<
  WorkoutStarterId,
  { name: string; focus: string; estimatedMin: number }
> = {
  custom: { name: 'O meu treino', focus: '', estimatedMin: 45 },
  push: { name: 'Push', focus: 'Peito, ombro e tríceps', estimatedMin: 55 },
  pull: { name: 'Pull', focus: 'Costas e bíceps', estimatedMin: 55 },
  legs: { name: 'Pernas', focus: 'Quadríceps, posterior e glúteo', estimatedMin: 60 },
  upper: { name: 'Superior', focus: 'Parte de cima', estimatedMin: 55 },
  lower: { name: 'Inferior', focus: 'Parte de baixo', estimatedMin: 55 },
  full: { name: 'Full body', focus: 'Corpo inteiro', estimatedMin: 50 },
}

export function buildWorkoutTemplate(
  dayOfWeek: number,
  starter: WorkoutStarterId = 'custom',
): WorkoutTemplate {
  const meta = STARTER_META[starter]
  return {
    id: makeId('tpl'),
    name: starter === 'custom' ? `Treino ${DAY_NAMES[dayOfWeek]}` : meta.name,
    focus: meta.focus,
    estimatedMin: meta.estimatedMin,
    dayOfWeek,
    exercises: buildExercises(starter),
  }
}
