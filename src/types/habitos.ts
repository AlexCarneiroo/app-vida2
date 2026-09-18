export type Habit = {
  id: string
  name: string
  detail: string
  streak: number
  doneToday: boolean
  lastDoneDateKey: string | null
  createdAt: string
}

export type HabitosState = {
  /** dia civil atual dos checkmarks */
  dayKey: string
  habits: Habit[]
}
