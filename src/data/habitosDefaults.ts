import { dateKey } from '../lib/date'
import { uid } from '../lib/storage'
import type { Habit, HabitosState } from '../types/habitos'

export function createHabit(name: string, detail = ''): Habit {
  return {
    id: uid('hab'),
    name: name.trim() || 'Novo hábito',
    detail: detail.trim(),
    streak: 0,
    doneToday: false,
    lastDoneDateKey: null,
    createdAt: new Date().toISOString(),
  }
}

/** Conta nova começa vazia — sem hábitos de exemplo. */
export const emptyHabitosState = (): HabitosState => ({
  dayKey: dateKey(),
  habits: [],
})
