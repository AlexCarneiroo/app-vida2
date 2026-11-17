import { describe, expect, it } from 'vitest'
import { emptySaudeState } from '../data/saudeDefaults'
import type { NutricaoState } from '../types/nutricao'
import {
  buildVidaReport,
  crossModuleHighlights,
  rangeWindow,
  reportHighlights,
} from './vidaReport'

function emptyNutri(): NutricaoState {
  return {
    entries: [],
    favorites: [],
    mealPlan: { days: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] } },
    dayLog: {},
    waterByDay: {},
    waterGoal: 2000,
    waterServingMl: 500,
    kcalGoal: 2000,
    proteinGoal: 120,
    carbsGoal: 200,
    fatGoal: 70,
  }
}

function baseInput(over: Partial<Parameters<typeof buildVidaReport>[0]> = {}) {
  const win = rangeWindow('week', new Date(2026, 10, 16))
  return {
    startKey: win.startKey,
    endKey: win.endKey,
    history: [],
    habits: [],
    personalGoals: [],
    habitsLog: {},
    rotinaLog: {},
    rotinaBlocks: 0,
    nutri: emptyNutri(),
    transactions: [],
    goals: [],
    bills: [],
    saude: emptySaudeState(),
    gameSessions: [],
    agendaEvents: [],
    shoppingLists: [],
    ...over,
  }
}

describe('rangeWindow week', () => {
  it('abre no domingo da semana', () => {
    const win = rangeWindow('week', new Date(2026, 10, 16))
    expect(win.startKey).toBe('2026-11-15')
    expect(win.endKey).toBe('2026-11-16')
  })
})

describe('buildVidaReport', () => {
  it('inclui secções agenda e compras', () => {
    const sections = buildVidaReport(
      baseInput({
        agendaEvents: [
          {
            id: 'e1',
            title: 'Reunião',
            description: '',
            dateKey: '2026-11-16',
            allDay: false,
            startTime: '10:00',
            endTime: '11:00',
            location: '',
            categoryId: 'trabalho',
            priority: 'media',
            color: null,
            notes: '',
            reminders: [],
            status: 'pendente',
            recurrence: {
              freq: 'none',
              weekdays: [],
              interval: 1,
              untilDateKey: null,
            },
            exceptionDateKeys: [],
            createdAt: '2026-11-16T09:00:00',
            updatedAt: '2026-11-16T09:00:00',
          },
        ],
        shoppingLists: [
          {
            id: 'l1',
            title: 'Mercado',
            status: 'done',
            items: [],
            createdAt: '2026-11-15T12:00:00',
            completedAt: '2026-11-16T12:00:00',
            totalSpent: 85.5,
            financeTxId: 'tx1',
            financeCategory: 'alimentação',
          },
        ],
      }),
    )
    const ids = sections.map((s) => s.id)
    expect(ids).toContain('agenda')
    expect(ids).toContain('compras')
    const agenda = sections.find((s) => s.id === 'agenda')!
    const compras = sections.find((s) => s.id === 'compras')!
    expect(agenda.empty).toBe(false)
    expect(compras.empty).toBe(false)
    expect(compras.highlight).toMatch(/85/)
  })
})

describe('crossModuleHighlights', () => {
  it('liga sono fraco com treinos', () => {
    const saude = emptySaudeState()
    saude.sleep = [
      {
        id: 's1',
        dateKey: '2026-11-15',
        hours: 5.5,
        quality: 2,
      },
      {
        id: 's2',
        dateKey: '2026-11-16',
        hours: 5,
        quality: 2,
      },
    ]
    const history = [
      {
        dateKey: '2026-11-16',
        templateId: 't1',
        name: 'Push',
        focus: 'peito',
        startedAt: '2026-11-16T07:00:00',
        completedAt: '2026-11-16T08:00:00',
        exercises: [],
      },
    ]
    const input = baseInput({ saude, history })
    const sections = buildVidaReport(input)
    const cross = crossModuleHighlights(sections, input)
    expect(cross.some((c) => c.id === 'sleep-treino' || c.id === 'sleep-low')).toBe(
      true,
    )
    expect(cross[0]?.to).toMatch(/^\/(treino|saude)$/)
  })

  it('reportHighlights devolve até 4 linhas', () => {
    const sections = buildVidaReport(
      baseInput({
        habitsLog: { '2026-11-15': 2, '2026-11-16': 3 },
        history: [
          {
            dateKey: '2026-11-16',
            templateId: 't1',
            name: 'Push',
            focus: 'peito',
            startedAt: '2026-11-16T07:00:00',
            completedAt: '2026-11-16T08:00:00',
            exercises: [],
          },
        ],
      }),
    )
    const lines = reportHighlights(sections)
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.length).toBeLessThanOrEqual(4)
  })
})
