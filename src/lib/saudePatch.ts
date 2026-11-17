import {
  createSleep,
  emptySaudeState,
  sleepForDay,
} from '../data/saudeDefaults'
import type { SaudeState, SleepHabitFlags, SleepQuality } from '../types/saude'
import { scheduleCloudSave } from './cloudSync'
import { dateKey } from './date'
import { loadSaudePersisted, touchPersisted } from './persist'

export const SAUDE_STORAGE_KEY = 'vida.saude.v1'

export function readSaudeState(): SaudeState {
  return loadSaudePersisted(SAUDE_STORAGE_KEY, emptySaudeState()).data
}

export function patchSaudeState(mutator: (prev: SaudeState) => SaudeState) {
  const doc = loadSaudePersisted(SAUDE_STORAGE_KEY, emptySaudeState())
  const next = mutator(doc.data)
  const at = Date.now()
  touchPersisted(SAUDE_STORAGE_KEY, next, at)
  scheduleCloudSave('saude', next, at, 280)
  window.dispatchEvent(
    new CustomEvent('vida:module-external', {
      detail: { storageKey: SAUDE_STORAGE_KEY, updatedAt: at },
    }),
  )
  return next
}

export function minutesOfTime(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return 0
  return Number(match[1]) * 60 + Number(match[2])
}

/** Pedido matinal ativo: opção ligada, já passou a hora e ainda sem registo hoje. */
export function shouldForceWakeSleepLog(
  state: SaudeState,
  now = new Date(),
): boolean {
  if (!state.wakeSleepGateEnabled) return false
  const today = dateKey(now)
  if (sleepForDay(state.sleep, today)) return false
  const gate = minutesOfTime(state.wakeSleepGateTime || '07:00')
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return nowMin >= gate
}

export function upsertSleepLocal(input: {
  hours: number
  quality: SleepQuality
  readiness?: SleepQuality
  bedTime?: string | null
  wakeTime?: string | null
  latencyMin?: number
  awakenings?: number
  habits?: Partial<SleepHabitFlags>
  note?: string
}) {
  const day = dateKey()
  const entry = createSleep({ ...input, dateKey: day })
  return patchSaudeState((prev) => {
    const rest = prev.sleep.filter((s) => s.dateKey !== day)
    return {
      ...prev,
      sleep: [entry, ...rest].slice(0, 180),
    }
  })
}
