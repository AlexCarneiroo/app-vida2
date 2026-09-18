export type RoutineBlock = {
  id: string
  time: string
  title: string
  detail: string
  doneToday: boolean
}

export type RotinaState = {
  dayKey: string
  blocks: RoutineBlock[]
}
