import type { MuscleGroup } from '../types/treino'

/** Exercícios prontos por grupo muscular (select no editor). */
export const EXERCISE_LIBRARY: Record<MuscleGroup, string[]> = {
  peito: [
    'Supino reto',
    'Supino inclinado',
    'Supino declinado',
    'Supino halteres',
    'Crucifixo',
    'Crucifixo inclinado',
    'Crossover',
    'Flexão de braço',
    'Peck deck',
  ],
  costas: [
    'Barra fixa',
    'Puxada frontal',
    'Puxada atrás',
    'Remada curvada',
    'Remada sentada',
    'Remada unilateral',
    'Remada cavalinho',
    'Levantamento terra',
    'Pullover',
  ],
  ombros: [
    'Desenvolvimento militar',
    'Desenvolvimento halteres',
    'Arnold press',
    'Elevação lateral',
    'Elevação frontal',
    'Elevação posterior',
    'Face pull',
    'Encolhimento',
  ],
  bíceps: [
    'Rosca direta',
    'Rosca alternada',
    'Rosca martelo',
    'Rosca scott',
    'Rosca concentrada',
    'Rosca na polia',
  ],
  tríceps: [
    'Tríceps corda',
    'Tríceps testa',
    'Tríceps francês',
    'Tríceps banco',
    'Mergulho',
    'Tríceps coice',
  ],
  pernas: [
    'Agachamento livre',
    'Agachamento goblet',
    'Agachamento búlgaro',
    'Leg press',
    'Hack squat',
    'Cadeira extensora',
    'Mesa flexora',
    'Stiff',
    'Levantamento terra romeno',
    'Avanço com halteres',
    'Afundo',
    'Elevação pélvica',
    'Panturrilha em pé',
    'Panturrilha sentado',
  ],
  core: [
    'Prancha',
    'Prancha lateral',
    'Abdominal crunch',
    'Abdominal infra',
    'Elevação de pernas',
    'Russian twist',
    'Ab wheel',
  ],
  cardio: [
    'Corrida',
    'Bike',
    'Elíptico',
    'Remo ergómetro',
    'Caminhada inclinada',
    'HIIT',
  ],
  mobilidade: [
    'Alongamento global',
    'Mobilidade torácica',
    'Mobilidade de quadril',
    'Foam roller',
    'Yoga leve',
  ],
}

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  peito: 'Peito',
  costas: 'Costas',
  ombros: 'Ombros',
  bíceps: 'Bíceps',
  tríceps: 'Tríceps',
  pernas: 'Pernas',
  core: 'Core',
  cardio: 'Cardio',
  mobilidade: 'Mobilidade',
}

export function exercisesForMuscle(muscle: MuscleGroup): string[] {
  return EXERCISE_LIBRARY[muscle] ?? []
}

export function defaultExerciseName(muscle: MuscleGroup): string {
  return exercisesForMuscle(muscle)[0] ?? 'Exercício'
}
