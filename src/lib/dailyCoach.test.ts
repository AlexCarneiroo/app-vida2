import { describe, expect, it } from 'vitest'
import { buildDailyCoach } from './dailyCoach'

const base = {
  hour: 10,
  sleepHours: 8 as number | null,
  sleepDebtHours: 0,
  waterMl: 1000,
  waterGoalMl: 2000,
  kcal: 800,
  kcalGoal: 2000,
  protein: 60,
  proteinGoal: 120,
  energy: 4 as number | null,
  workoutPlanned: true,
  workoutActive: false,
  workoutDone: false,
  pendingHabits: 0,
}

describe('buildDailyCoach', () => {
  it('usa poorSleepForTraining para sugerir treino leve', () => {
    const report = buildDailyCoach({
      ...base,
      sleepHours: 5.5,
      poorSleepForTraining: true,
      workoutPlanned: true,
    })
    const sleepAction = report.actions.find((a) => a.id === 'sleep-training')
    expect(sleepAction).toBeTruthy()
    expect(sleepAction?.to).toBe('/treino')
    expect(sleepAction?.text).toMatch(/leve/i)
  })

  it('sugere compras quando há muitos itens pendentes', () => {
    const report = buildDailyCoach({
      ...base,
      sleepHours: 8,
      pendingCompras: 5,
      pendingHabits: 0,
    })
    expect(report.actions.some((a) => a.id === 'compras')).toBe(true)
    expect(report.actions.find((a) => a.id === 'compras')?.to).toBe('/compras')
  })

  it('sugere finanças com contas a vencer', () => {
    const report = buildDailyCoach({
      ...base,
      sleepHours: 8,
      billsDue: 2,
      pendingHabits: 0,
    })
    expect(report.actions.some((a) => a.id === 'contas')).toBe(true)
    expect(report.actions.find((a) => a.id === 'contas')?.to).toBe('/financas')
  })

  it('limita a 3 actions', () => {
    const report = buildDailyCoach({
      ...base,
      sleepHours: 5,
      poorSleepForTraining: true,
      waterMl: 0,
      pendingCompras: 6,
      billsDue: 3,
      pendingHabits: 4,
    })
    expect(report.actions.length).toBeLessThanOrEqual(3)
  })
})
