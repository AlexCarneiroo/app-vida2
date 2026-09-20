import { dateKey } from '../lib/date'
import { uid } from '../lib/storage'
import type { RoutineBlock, RotinaState } from '../types/rotina'

export function createBlock(
  time: string,
  title: string,
  detail = '',
): RoutineBlock {
  return {
    id: uid('blk'),
    time,
    title: title.trim() || 'Bloco',
    detail: detail.trim(),
    doneToday: false,
  }
}

/** Conta nova começa vazia — sem blocos de exemplo. */
export const emptyRotinaState = (): RotinaState => ({
  dayKey: dateKey(),
  blocks: [],
  dayLog: {},
})
