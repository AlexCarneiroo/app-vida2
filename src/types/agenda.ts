export type AgendaCategoryId =
  | 'trabalho'
  | 'pessoal'
  | 'estudos'
  | 'saude'
  | 'treino'
  | 'familia'
  | 'financeiro'
  | 'lazer'
  | 'reunioes'
  | 'descanso'
  | 'outros'
  | string

export type AgendaPriority = 'baixa' | 'media' | 'alta'

export type AgendaStatus =
  | 'pendente'
  | 'concluido'
  | 'atrasado'
  | 'cancelado'

export type AgendaViewMode = 'month' | 'week' | 'day' | 'list'

export type AgendaListRange =
  | 'today'
  | 'tomorrow'
  | 'week'
  | 'next7'
  | 'month'
  | 'custom'

export type AgendaReminderOffset =
  | 0
  | 5
  | 15
  | 30
  | 60
  | 1440
  | number

export type AgendaRecurrenceFreq =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'custom'

export type AgendaRecurrence = {
  freq: AgendaRecurrenceFreq
  /** 0=dom … 6=sáb */
  weekdays: number[]
  interval: number
  untilDateKey: string | null
}

export type AgendaCategory = {
  id: AgendaCategoryId
  label: string
  color: string
  builtIn: boolean
}

export type AgendaEvent = {
  id: string
  title: string
  description: string
  dateKey: string
  allDay: boolean
  startTime: string | null
  endTime: string | null
  location: string
  categoryId: AgendaCategoryId
  priority: AgendaPriority
  color: string | null
  notes: string
  reminders: AgendaReminderOffset[]
  status: AgendaStatus
  recurrence: AgendaRecurrence
  /** IDs de ocorrências canceladas (YYYY-MM-DD) */
  exceptionDateKeys: string[]
  createdAt: string
  updatedAt: string
}

export type WorkShiftKind =
  | 'normal'
  | 'estendido'
  | 'plantao'
  | '12x36'
  | '6x1'
  | 'variavel'
  | 'folga'
  | 'ferias'
  | 'extra'

export type WeeklyAvailability = {
  /** 0=dom … 6=sáb */
  dayOfWeek: number
  enabled: boolean
  startTime: string
  endTime: string
  kind: WorkShiftKind
}

export type AvailabilityException = {
  id: string
  dateKey: string
  kind: WorkShiftKind
  startTime: string | null
  endTime: string | null
  note: string
}

export type AgendaState = {
  events: AgendaEvent[]
  categories: AgendaCategory[]
  weeklyAvailability: WeeklyAvailability[]
  exceptions: AvailabilityException[]
  sleepStart: string
  sleepEnd: string
}

export type AgendaItemSource =
  | 'event'
  | 'treino'
  | 'habito'
  | 'rotina'

export type AgendaItem = {
  id: string
  source: AgendaItemSource
  sourceId: string
  title: string
  detail: string
  dateKey: string
  allDay: boolean
  startTime: string | null
  endTime: string | null
  categoryId: AgendaCategoryId
  color: string
  status: AgendaStatus
  editable: boolean
  priority: AgendaPriority
}
