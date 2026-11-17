import { describe, expect, it } from 'vitest'
import { emptySaudeState } from '../data/saudeDefaults'
import {
  minutesOfTime,
  shouldForceWakeSleepLog,
} from './saudePatch'

describe('minutesOfTime', () => {
  it('converte HH:mm', () => {
    expect(minutesOfTime('07:00')).toBe(420)
    expect(minutesOfTime('00:30')).toBe(30)
  })

  it('devolve 0 para inválido', () => {
    expect(minutesOfTime('xx')).toBe(0)
  })
})

describe('shouldForceWakeSleepLog', () => {
  const morning = new Date(2026, 10, 17, 8, 0, 0)

  it('não bloqueia se a opção estiver desligada', () => {
    const state = emptySaudeState()
    state.wakeSleepGateEnabled = false
    expect(shouldForceWakeSleepLog(state, morning)).toBe(false)
  })

  it('bloqueia após a hora sem registo de sono hoje', () => {
    const state = emptySaudeState()
    state.wakeSleepGateEnabled = true
    state.wakeSleepGateTime = '07:00'
    expect(shouldForceWakeSleepLog(state, morning)).toBe(true)
  })

  it('não bloqueia antes da hora', () => {
    const early = new Date(2026, 10, 17, 6, 30, 0)
    const state = emptySaudeState()
    state.wakeSleepGateEnabled = true
    state.wakeSleepGateTime = '07:00'
    expect(shouldForceWakeSleepLog(state, early)).toBe(false)
  })

  it('não bloqueia se já há sono registado hoje', () => {
    const state = emptySaudeState()
    state.wakeSleepGateEnabled = true
    state.wakeSleepGateTime = '07:00'
    state.sleep = [
      {
        id: 's1',
        dateKey: '2026-11-17',
        hours: 7.5,
        quality: 4,
      },
    ]
    expect(shouldForceWakeSleepLog(state, morning)).toBe(false)
  })
})
