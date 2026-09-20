import { useCallback, useEffect, useMemo } from 'react'
import { createBlock, emptyRotinaState } from '../data/rotinaDefaults'
import { dateKey } from '../lib/date'
import { loadRotinaPersisted } from '../lib/persist'
import type { RotinaState } from '../types/rotina'
import { useCloudSyncedState } from './useCloudSyncedState'

const STORAGE_KEY = 'vida.rotina.v1'

function loadDoc() {
  return loadRotinaPersisted(STORAGE_KEY, emptyRotinaState())
}

const isEmpty = (d: RotinaState) => d.blocks.length === 0

function withDayLog(
  prev: RotinaState,
  blocks: RotinaState['blocks'],
  today: string,
): RotinaState {
  const done = blocks.filter((b) => b.doneToday).length
  const dayLog = { ...(prev.dayLog ?? {}) }
  if (done > 0) dayLog[today] = done
  else delete dayLog[today]
  return {
    ...prev,
    dayKey: today,
    blocks,
    dayLog,
  }
}

export function useRotina() {
  const { state, update } = useCloudSyncedState<RotinaState>({
    collection: 'rotina',
    storageKey: STORAGE_KEY,
    load: loadDoc,
    isEmpty,
  })

  const today = dateKey()

  useEffect(() => {
    if (state.dayKey === today) return
    update((prev) => ({
      ...prev,
      dayKey: today,
      dayLog: prev.dayLog ?? {},
      blocks: prev.blocks.map((b) => ({ ...b, doneToday: false })),
    }))
  }, [state.dayKey, today, update])

  const blocks = useMemo(
    () => [...state.blocks].sort((a, b) => a.time.localeCompare(b.time)),
    [state.blocks],
  )

  const doneCount = blocks.filter((b) => b.doneToday).length

  const toggleBlock = useCallback(
    (id: string) => {
      update((prev) => {
        const blocksNext = prev.blocks.map((b) =>
          b.id === id ? { ...b, doneToday: !b.doneToday } : b,
        )
        return withDayLog(prev, blocksNext, today)
      })
    },
    [today, update],
  )

  const addBlock = useCallback(
    (time: string, title: string, detail = '') => {
      const block = createBlock(time, title, detail)
      update((prev) => ({
        ...prev,
        dayLog: prev.dayLog ?? {},
        blocks: [...prev.blocks, block],
      }))
      return block.id
    },
    [update],
  )

  const removeBlock = useCallback(
    (id: string) => {
      update((prev) => {
        const blocksNext = prev.blocks.filter((b) => b.id !== id)
        return withDayLog(prev, blocksNext, today)
      })
    },
    [today, update],
  )

  const updateBlock = useCallback(
    (
      id: string,
      patch: Partial<{ time: string; title: string; detail: string }>,
    ) => {
      update((prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) =>
          b.id === id
            ? {
                ...b,
                time: patch.time ?? b.time,
                title: patch.title?.trim() || b.title,
                detail:
                  patch.detail !== undefined ? patch.detail.trim() : b.detail,
              }
            : b,
        ),
      }))
    },
    [update],
  )

  return {
    blocks,
    doneCount,
    total: blocks.length,
    dayLog: state.dayLog ?? {},
    toggleBlock,
    addBlock,
    removeBlock,
    updateBlock,
  }
}
