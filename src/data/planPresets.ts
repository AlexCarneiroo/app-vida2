import type { WorkoutTemplate } from '../types/treino'

function sets(count: number, reps: number, weight: number) {
  return Array.from({ length: count }, () => ({ reps, weight }))
}

function clonePlan(plan: WorkoutTemplate[]): WorkoutTemplate[] {
  return JSON.parse(JSON.stringify(plan)) as WorkoutTemplate[]
}

export type PlanGoal =
  | 'hipertrofia'
  | 'força'
  | 'emagrecer'
  | 'iniciante'
  | 'definição'

export const PLAN_GOAL_LABELS: Record<PlanGoal, string> = {
  hipertrofia: 'Hipertrofia',
  força: 'Força',
  emagrecer: 'Emagrecer',
  iniciante: 'Iniciante',
  definição: 'Definição',
}

export type WeeklyPlanPreset = {
  id: string
  name: string
  goal: PlanGoal
  tagline: string
  daysPerWeek: number
  level: 'Iniciante' | 'Intermédio' | 'Avançado'
  templates: WorkoutTemplate[]
}

export const PLAN_PRESETS: WeeklyPlanPreset[] = [
  {
    id: 'ppl-classic',
    name: 'Push / Pull / Legs',
    goal: 'hipertrofia',
    tagline: 'Clássico de volume — peito, costas e pernas bem trabalhados.',
    daysPerWeek: 4,
    level: 'Intermédio',
    templates: [
      {
        id: 'ppl-push',
        name: 'Push — Peito & Ombros',
        focus: 'Peito · ombro · tríceps',
        estimatedMin: 55,
        dayOfWeek: 1,
        exercises: [
          { id: 'bp', name: 'Supino reto', muscle: 'peito', sets: sets(4, 8, 60) },
          {
            id: 'ohp',
            name: 'Desenvolvimento militar',
            muscle: 'ombros',
            sets: sets(3, 10, 30),
          },
          {
            id: 'fly',
            name: 'Crucifixo inclinado',
            muscle: 'peito',
            sets: sets(3, 12, 16),
          },
          {
            id: 'lateral',
            name: 'Elevação lateral',
            muscle: 'ombros',
            sets: sets(3, 15, 10),
          },
          { id: 'tri', name: 'Tríceps corda', muscle: 'tríceps', sets: sets(3, 12, 25) },
        ],
      },
      {
        id: 'ppl-pull',
        name: 'Pull — Costas & Bíceps',
        focus: 'Costas · bíceps · posterior',
        estimatedMin: 55,
        dayOfWeek: 2,
        exercises: [
          {
            id: 'row',
            name: 'Remada curvada',
            muscle: 'costas',
            sets: sets(4, 8, 50),
          },
          {
            id: 'pulldown',
            name: 'Puxada frontal',
            muscle: 'costas',
            sets: sets(3, 10, 45),
          },
          { id: 'face', name: 'Face pull', muscle: 'ombros', sets: sets(3, 15, 20) },
          { id: 'curl', name: 'Rosca direta', muscle: 'bíceps', sets: sets(3, 12, 16) },
          {
            id: 'hammer',
            name: 'Rosca martelo',
            muscle: 'bíceps',
            sets: sets(3, 12, 14),
          },
        ],
      },
      {
        id: 'ppl-legs',
        name: 'Legs — Inferiores',
        focus: 'Quadríceps · glúteo · posterior',
        estimatedMin: 60,
        dayOfWeek: 4,
        exercises: [
          {
            id: 'squat',
            name: 'Agachamento livre',
            muscle: 'pernas',
            sets: sets(4, 8, 70),
          },
          {
            id: 'rdl',
            name: 'Levantamento terra romeno',
            muscle: 'pernas',
            sets: sets(3, 10, 60),
          },
          { id: 'legpress', name: 'Leg press', muscle: 'pernas', sets: sets(3, 12, 120) },
          {
            id: 'lunges',
            name: 'Avanço com halteres',
            muscle: 'pernas',
            sets: sets(3, 10, 20),
          },
          {
            id: 'core',
            name: 'Prancha',
            muscle: 'core',
            notes: 'segundos por série',
            sets: sets(3, 45, 0),
          },
        ],
      },
      {
        id: 'ppl-upper',
        name: 'Upper leve',
        focus: 'Volume moderado · técnica',
        estimatedMin: 45,
        dayOfWeek: 5,
        exercises: [
          {
            id: 'dbpress',
            name: 'Supino halteres',
            muscle: 'peito',
            sets: sets(3, 10, 24),
          },
          {
            id: 'seatedrow',
            name: 'Remada sentada',
            muscle: 'costas',
            sets: sets(3, 12, 40),
          },
          {
            id: 'shoulder',
            name: 'Arnold press',
            muscle: 'ombros',
            sets: sets(3, 10, 16),
          },
          {
            id: 'mob',
            name: 'Mobilidade torácica',
            muscle: 'mobilidade',
            notes: 'fluxo livre',
            sets: sets(2, 10, 0),
          },
        ],
      },
    ],
  },
  {
    id: 'fullbody-3',
    name: 'Full Body 3×',
    goal: 'iniciante',
    tagline: 'Corpo inteiro 3 vezes — ideal para começar ou pouco tempo.',
    daysPerWeek: 3,
    level: 'Iniciante',
    templates: [
      {
        id: 'fb-a',
        name: 'Full Body A',
        focus: 'Agachamento · empurrar · puxar',
        estimatedMin: 45,
        dayOfWeek: 1,
        exercises: [
          {
            id: 'sq',
            name: 'Agachamento goblet',
            muscle: 'pernas',
            sets: sets(3, 10, 20),
          },
          {
            id: 'press',
            name: 'Supino halteres',
            muscle: 'peito',
            sets: sets(3, 10, 16),
          },
          {
            id: 'row',
            name: 'Remada unilateral',
            muscle: 'costas',
            sets: sets(3, 10, 14),
          },
          {
            id: 'plank',
            name: 'Prancha',
            muscle: 'core',
            notes: 'segundos',
            sets: sets(3, 30, 0),
          },
        ],
      },
      {
        id: 'fb-b',
        name: 'Full Body B',
        focus: 'Posterior · ombros · core',
        estimatedMin: 45,
        dayOfWeek: 3,
        exercises: [
          {
            id: 'rdl',
            name: 'Levantamento terra romeno',
            muscle: 'pernas',
            sets: sets(3, 10, 40),
          },
          {
            id: 'ohp',
            name: 'Desenvolvimento halteres',
            muscle: 'ombros',
            sets: sets(3, 10, 12),
          },
          {
            id: 'pull',
            name: 'Puxada frontal',
            muscle: 'costas',
            sets: sets(3, 10, 35),
          },
          {
            id: 'crunch',
            name: 'Abdominal crunch',
            muscle: 'core',
            sets: sets(3, 15, 0),
          },
        ],
      },
      {
        id: 'fb-c',
        name: 'Full Body C',
        focus: 'Pernas · peito · braços',
        estimatedMin: 45,
        dayOfWeek: 5,
        exercises: [
          { id: 'lp', name: 'Leg press', muscle: 'pernas', sets: sets(3, 12, 80) },
          {
            id: 'incline',
            name: 'Supino inclinado',
            muscle: 'peito',
            sets: sets(3, 10, 40),
          },
          { id: 'curl', name: 'Rosca direta', muscle: 'bíceps', sets: sets(3, 12, 12) },
          {
            id: 'tri',
            name: 'Tríceps corda',
            muscle: 'tríceps',
            sets: sets(3, 12, 20),
          },
        ],
      },
    ],
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower',
    goal: 'hipertrofia',
    tagline: '4 dias — superior e inferior alternados, bom equilíbrio.',
    daysPerWeek: 4,
    level: 'Intermédio',
    templates: [
      {
        id: 'ul-u1',
        name: 'Upper A',
        focus: 'Peito · costas · ombros',
        estimatedMin: 55,
        dayOfWeek: 1,
        exercises: [
          { id: 'bp', name: 'Supino reto', muscle: 'peito', sets: sets(4, 8, 55) },
          {
            id: 'row',
            name: 'Remada curvada',
            muscle: 'costas',
            sets: sets(4, 8, 45),
          },
          {
            id: 'ohp',
            name: 'Desenvolvimento militar',
            muscle: 'ombros',
            sets: sets(3, 10, 28),
          },
          { id: 'curl', name: 'Rosca martelo', muscle: 'bíceps', sets: sets(3, 12, 12) },
          {
            id: 'tri',
            name: 'Tríceps testa',
            muscle: 'tríceps',
            sets: sets(3, 12, 18),
          },
        ],
      },
      {
        id: 'ul-l1',
        name: 'Lower A',
        focus: 'Agachamento · posterior',
        estimatedMin: 55,
        dayOfWeek: 2,
        exercises: [
          {
            id: 'sq',
            name: 'Agachamento livre',
            muscle: 'pernas',
            sets: sets(4, 8, 65),
          },
          { id: 'rdl', name: 'Stiff', muscle: 'pernas', sets: sets(3, 10, 50) },
          {
            id: 'leg',
            name: 'Cadeira extensora',
            muscle: 'pernas',
            sets: sets(3, 12, 40),
          },
          {
            id: 'calf',
            name: 'Panturrilha em pé',
            muscle: 'pernas',
            sets: sets(3, 15, 40),
          },
        ],
      },
      {
        id: 'ul-u2',
        name: 'Upper B',
        focus: 'Volume de puxar e empurrar',
        estimatedMin: 50,
        dayOfWeek: 4,
        exercises: [
          {
            id: 'incline',
            name: 'Supino inclinado',
            muscle: 'peito',
            sets: sets(3, 10, 45),
          },
          {
            id: 'pull',
            name: 'Puxada frontal',
            muscle: 'costas',
            sets: sets(3, 10, 45),
          },
          {
            id: 'lat',
            name: 'Elevação lateral',
            muscle: 'ombros',
            sets: sets(3, 15, 8),
          },
          {
            id: 'face',
            name: 'Face pull',
            muscle: 'ombros',
            sets: sets(3, 15, 18),
          },
        ],
      },
      {
        id: 'ul-l2',
        name: 'Lower B',
        focus: 'Leg press · glúteo · core',
        estimatedMin: 50,
        dayOfWeek: 5,
        exercises: [
          { id: 'lp', name: 'Leg press', muscle: 'pernas', sets: sets(4, 10, 110) },
          {
            id: 'hip',
            name: 'Elevação pélvica',
            muscle: 'pernas',
            sets: sets(3, 12, 60),
          },
          {
            id: 'curl',
            name: 'Mesa flexora',
            muscle: 'pernas',
            sets: sets(3, 12, 35),
          },
          {
            id: 'plank',
            name: 'Prancha',
            muscle: 'core',
            notes: 'segundos',
            sets: sets(3, 40, 0),
          },
        ],
      },
    ],
  },
  {
    id: 'strength-5x5',
    name: 'Força — compostos',
    goal: 'força',
    tagline: 'Poucos movimentos pesados. Progressão de carga em 1º lugar.',
    daysPerWeek: 3,
    level: 'Intermédio',
    templates: [
      {
        id: 's-a',
        name: 'Força A',
        focus: 'Agachamento · supino · remada',
        estimatedMin: 50,
        dayOfWeek: 1,
        exercises: [
          {
            id: 'sq',
            name: 'Agachamento livre',
            muscle: 'pernas',
            sets: sets(5, 5, 80),
          },
          { id: 'bp', name: 'Supino reto', muscle: 'peito', sets: sets(5, 5, 70) },
          {
            id: 'row',
            name: 'Remada curvada',
            muscle: 'costas',
            sets: sets(5, 5, 55),
          },
        ],
      },
      {
        id: 's-b',
        name: 'Força B',
        focus: 'Terra · desenvolvimento · puxada',
        estimatedMin: 50,
        dayOfWeek: 3,
        exercises: [
          {
            id: 'dl',
            name: 'Levantamento terra',
            muscle: 'costas',
            sets: sets(5, 5, 90),
          },
          {
            id: 'ohp',
            name: 'Desenvolvimento militar',
            muscle: 'ombros',
            sets: sets(5, 5, 35),
          },
          {
            id: 'pull',
            name: 'Puxada frontal',
            muscle: 'costas',
            sets: sets(3, 8, 50),
          },
        ],
      },
      {
        id: 's-c',
        name: 'Força C',
        focus: 'Agachamento · peito · posterior',
        estimatedMin: 50,
        dayOfWeek: 5,
        exercises: [
          {
            id: 'sq',
            name: 'Agachamento livre',
            muscle: 'pernas',
            sets: sets(5, 5, 80),
          },
          {
            id: 'incline',
            name: 'Supino inclinado',
            muscle: 'peito',
            sets: sets(4, 6, 50),
          },
          { id: 'rdl', name: 'Stiff', muscle: 'pernas', sets: sets(3, 8, 60) },
        ],
      },
    ],
  },
  {
    id: 'fat-loss',
    name: 'Emagrecer — força + cardio',
    goal: 'emagrecer',
    tagline: 'Treino de força curto + cardio Zona 2 no fim de semana.',
    daysPerWeek: 4,
    level: 'Iniciante',
    templates: [
      {
        id: 'fl-1',
        name: 'Full Body metabólico',
        focus: 'Circuito de compostos',
        estimatedMin: 40,
        dayOfWeek: 1,
        exercises: [
          {
            id: 'sq',
            name: 'Agachamento goblet',
            muscle: 'pernas',
            sets: sets(3, 12, 16),
          },
          {
            id: 'press',
            name: 'Supino halteres',
            muscle: 'peito',
            sets: sets(3, 12, 14),
          },
          {
            id: 'row',
            name: 'Remada sentada',
            muscle: 'costas',
            sets: sets(3, 12, 35),
          },
          {
            id: 'plank',
            name: 'Prancha',
            muscle: 'core',
            notes: 'segundos',
            sets: sets(3, 35, 0),
          },
        ],
      },
      {
        id: 'fl-2',
        name: 'Inferiores + core',
        focus: 'Pernas e gasto calórico',
        estimatedMin: 40,
        dayOfWeek: 3,
        exercises: [
          { id: 'lp', name: 'Leg press', muscle: 'pernas', sets: sets(3, 15, 90) },
          {
            id: 'lunges',
            name: 'Afundo',
            muscle: 'pernas',
            sets: sets(3, 12, 12),
          },
          {
            id: 'hip',
            name: 'Elevação pélvica',
            muscle: 'pernas',
            sets: sets(3, 15, 40),
          },
          {
            id: 'bike',
            name: 'Bike',
            muscle: 'cardio',
            notes: 'minutos',
            sets: [{ reps: 12, weight: 0 }],
          },
        ],
      },
      {
        id: 'fl-3',
        name: 'Superiores + core',
        focus: 'Empurrar · puxar · braços',
        estimatedMin: 40,
        dayOfWeek: 5,
        exercises: [
          {
            id: 'push',
            name: 'Flexão de braço',
            muscle: 'peito',
            sets: sets(3, 12, 0),
          },
          {
            id: 'pull',
            name: 'Puxada frontal',
            muscle: 'costas',
            sets: sets(3, 12, 35),
          },
          {
            id: 'lat',
            name: 'Elevação lateral',
            muscle: 'ombros',
            sets: sets(3, 15, 6),
          },
          {
            id: 'crunch',
            name: 'Abdominal infra',
            muscle: 'core',
            sets: sets(3, 15, 0),
          },
        ],
      },
      {
        id: 'fl-cardio',
        name: 'Cardio Zona 2',
        focus: 'Base aeróbica',
        estimatedMin: 35,
        dayOfWeek: 6,
        exercises: [
          {
            id: 'run',
            name: 'Corrida',
            muscle: 'cardio',
            notes: 'minutos · ritmo conversa',
            sets: [{ reps: 30, weight: 0 }],
          },
          {
            id: 'stretch',
            name: 'Alongamento global',
            muscle: 'mobilidade',
            sets: [{ reps: 10, weight: 0 }],
          },
        ],
      },
    ],
  },
  {
    id: 'glute-focus',
    name: 'Glúteo & pernas',
    goal: 'definição',
    tagline: 'Ênfase em inferiores e glúteo, com 1 dia de superior.',
    daysPerWeek: 4,
    level: 'Intermédio',
    templates: [
      {
        id: 'g1',
        name: 'Glúteo A',
        focus: 'Quadril · posterior',
        estimatedMin: 50,
        dayOfWeek: 1,
        exercises: [
          {
            id: 'hip',
            name: 'Elevação pélvica',
            muscle: 'pernas',
            sets: sets(4, 12, 70),
          },
          { id: 'rdl', name: 'Stiff', muscle: 'pernas', sets: sets(3, 10, 45) },
          {
            id: 'abul',
            name: 'Agachamento búlgaro',
            muscle: 'pernas',
            sets: sets(3, 10, 12),
          },
          {
            id: 'curl',
            name: 'Mesa flexora',
            muscle: 'pernas',
            sets: sets(3, 12, 30),
          },
        ],
      },
      {
        id: 'g2',
        name: 'Upper leve',
        focus: 'Manutenção de superiores',
        estimatedMin: 40,
        dayOfWeek: 2,
        exercises: [
          {
            id: 'press',
            name: 'Supino halteres',
            muscle: 'peito',
            sets: sets(3, 10, 16),
          },
          {
            id: 'row',
            name: 'Remada sentada',
            muscle: 'costas',
            sets: sets(3, 12, 35),
          },
          {
            id: 'lat',
            name: 'Elevação lateral',
            muscle: 'ombros',
            sets: sets(3, 15, 6),
          },
        ],
      },
      {
        id: 'g3',
        name: 'Glúteo B',
        focus: 'Agachamento · leg press',
        estimatedMin: 55,
        dayOfWeek: 4,
        exercises: [
          {
            id: 'sq',
            name: 'Agachamento livre',
            muscle: 'pernas',
            sets: sets(4, 8, 55),
          },
          { id: 'lp', name: 'Leg press', muscle: 'pernas', sets: sets(3, 12, 100) },
          {
            id: 'ext',
            name: 'Cadeira extensora',
            muscle: 'pernas',
            sets: sets(3, 15, 35),
          },
          {
            id: 'calf',
            name: 'Panturrilha sentado',
            muscle: 'pernas',
            sets: sets(3, 15, 30),
          },
        ],
      },
      {
        id: 'g4',
        name: 'Glúteo C + core',
        focus: 'Volume e estabilidade',
        estimatedMin: 45,
        dayOfWeek: 6,
        exercises: [
          {
            id: 'hip',
            name: 'Elevação pélvica',
            muscle: 'pernas',
            sets: sets(3, 15, 60),
          },
          {
            id: 'lunges',
            name: 'Avanço com halteres',
            muscle: 'pernas',
            sets: sets(3, 12, 10),
          },
          {
            id: 'side',
            name: 'Prancha lateral',
            muscle: 'core',
            notes: 'segundos',
            sets: sets(3, 30, 0),
          },
        ],
      },
    ],
  },
  {
    id: 'abc-bro',
    name: 'ABC — divisão clássica',
    goal: 'hipertrofia',
    tagline: 'Peito/tríceps, costas/bíceps, pernas — 3 dias diretos.',
    daysPerWeek: 3,
    level: 'Iniciante',
    templates: [
      {
        id: 'abc-a',
        name: 'A — Peito & tríceps',
        focus: 'Empurrar',
        estimatedMin: 50,
        dayOfWeek: 1,
        exercises: [
          { id: 'bp', name: 'Supino reto', muscle: 'peito', sets: sets(4, 8, 50) },
          {
            id: 'incline',
            name: 'Supino inclinado',
            muscle: 'peito',
            sets: sets(3, 10, 40),
          },
          { id: 'fly', name: 'Crucifixo', muscle: 'peito', sets: sets(3, 12, 12) },
          {
            id: 'tri',
            name: 'Tríceps corda',
            muscle: 'tríceps',
            sets: sets(3, 12, 22),
          },
        ],
      },
      {
        id: 'abc-b',
        name: 'B — Costas & bíceps',
        focus: 'Puxar',
        estimatedMin: 50,
        dayOfWeek: 3,
        exercises: [
          {
            id: 'pull',
            name: 'Puxada frontal',
            muscle: 'costas',
            sets: sets(4, 8, 45),
          },
          {
            id: 'row',
            name: 'Remada curvada',
            muscle: 'costas',
            sets: sets(3, 10, 45),
          },
          { id: 'curl', name: 'Rosca direta', muscle: 'bíceps', sets: sets(3, 12, 14) },
          {
            id: 'hammer',
            name: 'Rosca martelo',
            muscle: 'bíceps',
            sets: sets(3, 12, 12),
          },
        ],
      },
      {
        id: 'abc-c',
        name: 'C — Pernas & ombros',
        focus: 'Inferiores · deltóides',
        estimatedMin: 55,
        dayOfWeek: 5,
        exercises: [
          {
            id: 'sq',
            name: 'Agachamento livre',
            muscle: 'pernas',
            sets: sets(4, 8, 60),
          },
          { id: 'lp', name: 'Leg press', muscle: 'pernas', sets: sets(3, 12, 100) },
          {
            id: 'ohp',
            name: 'Desenvolvimento halteres',
            muscle: 'ombros',
            sets: sets(3, 10, 14),
          },
          {
            id: 'lat',
            name: 'Elevação lateral',
            muscle: 'ombros',
            sets: sets(3, 15, 8),
          },
        ],
      },
    ],
  },
]

export function getPresetById(id: string): WeeklyPlanPreset | undefined {
  return PLAN_PRESETS.find((p) => p.id === id)
}

export function clonePresetPlan(preset: WeeklyPlanPreset): WorkoutTemplate[] {
  return clonePlan(preset.templates)
}
