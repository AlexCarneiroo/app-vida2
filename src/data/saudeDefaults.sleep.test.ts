import { describe, expect, it } from 'vitest'
import { buildHealthInsights, sleepHoursBetween } from './saudeDefaults'
import type { VitalSignals } from './saudeDefaults'

describe('sleepHoursBetween', () => {
  it('calcula noite que cruza meia-noite', () => {
    expect(sleepHoursBetween('22:30', '06:30')).toBe(8)
  })

  it('calcula no mesmo dia', () => {
    expect(sleepHoursBetween('01:00', '08:00')).toBe(7)
  })

  it('rejeita horários iguais', () => {
    expect(sleepHoursBetween('22:00', '22:00')).toBeNull()
  })
})

describe('buildHealthInsights links', () => {
  const base: VitalSignals = {
    waterMl: 0,
    waterGoalMl: 2000,
    waterOk: false,
    waterWeekDays: 0,
    kcal: 0,
    kcalGoal: 2000,
    protein: 0,
    proteinGoal: 120,
    trainedToday: false,
    sleepHours: null,
    sleepOk: false,
    sleepWeekDays: 0,
    imc: null,
    imcOk: false,
    checkInDone: false,
    healthHabitsDone: 0,
    healthHabitsTotal: 2,
    weeklyGoals: { waterDaysTarget: 5, sleepDaysTarget: 5 },
  }

  it('adiciona deep-links nos insights', () => {
    const list = buildHealthInsights(base, 0)
    expect(list.some((i) => i.id === 'water-empty' && i.to === '/nutricao')).toBe(
      true,
    )
    expect(list.some((i) => i.id === 'sleep-miss' && i.to === '/saude')).toBe(
      true,
    )
    expect(list.some((i) => i.id === 'treino-miss' && i.to === '/treino')).toBe(
      true,
    )
    expect(list.some((i) => i.id === 'habits' && i.to === '/habitos')).toBe(true)
  })
})
