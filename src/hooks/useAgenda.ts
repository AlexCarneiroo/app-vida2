import { useCallback, useMemo } from 'react'
import {
  createAgendaEvent,
  createAvailabilityException,
  emptyAgendaState,
} from '../data/agendaDefaults'
import { dateKey } from '../lib/date'
import { loadAgendaPersisted } from '../lib/persist'
import type {
  AgendaCategory,
  AgendaEvent,
  AgendaPriority,
  AgendaRecurrence,
  AgendaState,
  AgendaStatus,
  AvailabilityException,
  WeeklyAvailability,
  WorkShiftKind,
} from '../types/agenda'
import { useCloudSyncedState } from './useCloudSyncedState'

const STORAGE_KEY = 'vida.agenda.v1'

function loadDoc() {
  return loadAgendaPersisted(STORAGE_KEY, emptyAgendaState())
}

const isEmpty = (d: AgendaState) =>
  d.events.length === 0 &&
  d.exceptions.length === 0 &&
  d.categories.every((c) => c.builtIn)

export function useAgenda() {
  const { state, update } = useCloudSyncedState<AgendaState>({
    collection: 'agenda',
    storageKey: STORAGE_KEY,
    load: loadDoc,
    isEmpty,
  })

  const addEvent = useCallback(
    (input: Parameters<typeof createAgendaEvent>[0]) => {
      const event = createAgendaEvent(input)
      update((prev) => ({
        ...prev,
        events: [event, ...prev.events].slice(0, 500),
      }))
      return event.id
    },
    [update],
  )

  const updateEvent = useCallback(
    (
      id: string,
      patch: Partial<
        Omit<AgendaEvent, 'id' | 'createdAt' | 'updatedAt' | 'exceptionDateKeys'>
      > & { exceptionDateKeys?: string[] },
    ) => {
      update((prev) => ({
        ...prev,
        events: prev.events.map((e) => {
          if (e.id !== id) return e
          const allDay = patch.allDay ?? e.allDay
          return {
            ...e,
            ...patch,
            title: patch.title?.trim() || e.title,
            description:
              patch.description !== undefined
                ? patch.description.trim()
                : e.description,
            allDay,
            startTime: allDay
              ? null
              : patch.startTime !== undefined
                ? patch.startTime
                : e.startTime,
            endTime: allDay
              ? null
              : patch.endTime !== undefined
                ? patch.endTime
                : e.endTime,
            location:
              patch.location !== undefined ? patch.location.trim() : e.location,
            notes: patch.notes !== undefined ? patch.notes.trim() : e.notes,
            updatedAt: new Date().toISOString(),
          }
        }),
      }))
    },
    [update],
  )

  const removeEvent = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        events: prev.events.filter((e) => e.id !== id),
      }))
    },
    [update],
  )

  const cancelOccurrence = useCallback(
    (id: string, occurrenceDateKey: string) => {
      update((prev) => ({
        ...prev,
        events: prev.events.map((e) => {
          if (e.id !== id) return e
          if (e.recurrence.freq === 'none') {
            return {
              ...e,
              status: 'cancelado' as const,
              updatedAt: new Date().toISOString(),
            }
          }
          const keys = new Set(e.exceptionDateKeys)
          keys.add(occurrenceDateKey)
          return {
            ...e,
            exceptionDateKeys: [...keys],
            updatedAt: new Date().toISOString(),
          }
        }),
      }))
    },
    [update],
  )

  const duplicateEvent = useCallback(
    (id: string, targetDateKey = dateKey()) => {
      const source = state.events.find((e) => e.id === id)
      if (!source) return null
      return addEvent({
        title: source.title,
        description: source.description,
        dateKey: targetDateKey,
        allDay: source.allDay,
        startTime: source.startTime,
        endTime: source.endTime,
        location: source.location,
        categoryId: source.categoryId,
        priority: source.priority,
        color: source.color,
        notes: source.notes,
        reminders: source.reminders,
        status: 'pendente',
        recurrence: {
          freq: 'none',
          weekdays: [],
          interval: 1,
          untilDateKey: null,
        },
      })
    },
    [addEvent, state.events],
  )

  const setEventStatus = useCallback(
    (id: string, status: AgendaStatus) => {
      updateEvent(id, { status })
    },
    [updateEvent],
  )

  const addCategory = useCallback(
    (label: string, color: string) => {
      const name = label.trim()
      if (!name) return null
      const id = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || `cat_${Date.now()}`
      update((prev) => {
        if (prev.categories.some((c) => c.id === id)) return prev
        return {
          ...prev,
          categories: [
            ...prev.categories,
            { id, label: name, color, builtIn: false },
          ],
        }
      })
      return id
    },
    [update],
  )

  const removeCategory = useCallback(
    (id: string) => {
      update((prev) => {
        const cat = prev.categories.find((c) => c.id === id)
        if (!cat || cat.builtIn) return prev
        return {
          ...prev,
          categories: prev.categories.filter((c) => c.id !== id),
          events: prev.events.map((e) =>
            e.categoryId === id ? { ...e, categoryId: 'outros' } : e,
          ),
        }
      })
    },
    [update],
  )

  const setWeeklyAvailability = useCallback(
    (rows: WeeklyAvailability[]) => {
      update((prev) => ({ ...prev, weeklyAvailability: rows }))
    },
    [update],
  )

  const upsertException = useCallback(
    (input: {
      dateKey: string
      kind: WorkShiftKind
      startTime?: string | null
      endTime?: string | null
      note?: string
    }) => {
      update((prev) => {
        const rest = prev.exceptions.filter((e) => e.dateKey !== input.dateKey)
        return {
          ...prev,
          exceptions: [
            createAvailabilityException(input),
            ...rest,
          ].slice(0, 200),
        }
      })
    },
    [update],
  )

  const removeException = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        exceptions: prev.exceptions.filter((e) => e.id !== id),
      }))
    },
    [update],
  )

  const setSleepWindow = useCallback(
    (sleepStart: string, sleepEnd: string) => {
      update((prev) => ({ ...prev, sleepStart, sleepEnd }))
    },
    [update],
  )

  const eventById = useMemo(
    () => new Map(state.events.map((e) => [e.id, e])),
    [state.events],
  )

  return {
    state,
    events: state.events,
    categories: state.categories,
    weeklyAvailability: state.weeklyAvailability,
    exceptions: state.exceptions,
    sleepStart: state.sleepStart,
    sleepEnd: state.sleepEnd,
    eventById,
    addEvent,
    updateEvent,
    removeEvent,
    cancelOccurrence,
    duplicateEvent,
    setEventStatus,
    addCategory,
    removeCategory,
    setWeeklyAvailability,
    upsertException,
    removeException,
    setSleepWindow,
  }
}

export type AgendaEventDraft = {
  title: string
  description: string
  dateKey: string
  allDay: boolean
  startTime: string
  endTime: string
  location: string
  categoryId: string
  priority: AgendaPriority
  color: string | null
  notes: string
  reminders: number[]
  recurrence: AgendaRecurrence
}

export type { AgendaCategory, AvailabilityException }
