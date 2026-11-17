import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NOTIF_SETTINGS,
  normalizeNotifSettings,
} from './notifSettings'

describe('normalizeNotifSettings', () => {
  it('inclui resumoSemanal por defeito', () => {
    const s = normalizeNotifSettings(null)
    expect(s.resumoSemanal).toEqual({
      on: false,
      time: '20:00',
      weekday: 0,
    })
  })

  it('preserva resumoSemanal válido', () => {
    const s = normalizeNotifSettings({
      ...DEFAULT_NOTIF_SETTINGS,
      resumoSemanal: { on: true, time: '19:30', weekday: 3 },
    })
    expect(s.resumoSemanal.on).toBe(true)
    expect(s.resumoSemanal.time).toBe('19:30')
    expect(s.resumoSemanal.weekday).toBe(3)
  })

  it('corrige weekday e hora inválidos', () => {
    const s = normalizeNotifSettings({
      resumoSemanal: { on: true, time: '25:99', weekday: 9 },
    })
    expect(s.resumoSemanal.time).toBe('20:00')
    expect(s.resumoSemanal.weekday).toBe(0)
  })
})
