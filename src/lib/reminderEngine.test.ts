import { describe, expect, it } from 'vitest'
import { DEFAULT_NOTIF_SETTINGS, type NotifSettings } from './notifSettings'
import { collectDueReminders, type ReminderContext } from './reminderEngine'

/** Domingo 15/11/2026 20:05 local (weekday 0). */
const SUNDAY_2005 = new Date(2026, 10, 15, 20, 5, 0)

function settings(patch: Partial<NotifSettings> = {}): NotifSettings {
  return {
    ...DEFAULT_NOTIF_SETTINGS,
    enabled: true,
    ...patch,
    resumoSemanal: {
      ...DEFAULT_NOTIF_SETTINGS.resumoSemanal,
      ...(patch.resumoSemanal ?? {}),
    },
  }
}

function ctx(
  now: Date,
  notif: Partial<NotifSettings>,
  states: Record<string, unknown> = {},
): ReminderContext {
  return {
    now,
    settings: settings(notif),
    read: (name) => (states[name] as never) ?? null,
  }
}

describe('collectDueReminders · resumoSemanal', () => {
  it('dispara no domingo à hora configurada', () => {
    const due = collectDueReminders(
      ctx(
        SUNDAY_2005,
        {
          resumoSemanal: { on: true, time: '20:00', weekday: 0 },
        },
        {
          treino: {
            history: [
              {
                dateKey: '2026-11-15',
                templateId: 't1',
                name: 'Push',
                focus: 'peito',
                startedAt: '2026-11-15T09:00:00',
                completedAt: '2026-11-15T10:00:00',
                exercises: [],
              },
            ],
          },
          habitos: { dayLog: { '2026-11-15': 3 } },
        },
      ),
    )
    const weekly = due.find((d) => d.tag === 'resumoSemanal')
    expect(weekly).toBeTruthy()
    expect(weekly?.url).toBe('/relatorio?range=week')
    expect(weekly?.id).toMatch(/^resumoSemanal:/)
    expect(weekly?.body).toMatch(/treino/i)
  })

  it('não dispara noutro dia da semana', () => {
    const monday = new Date(2026, 10, 16, 20, 5, 0)
    const due = collectDueReminders(
      ctx(monday, {
        resumoSemanal: { on: true, time: '20:00', weekday: 0 },
      }),
    )
    expect(due.some((d) => d.tag === 'resumoSemanal')).toBe(false)
  })

  it('não dispara se estiver desligado', () => {
    const due = collectDueReminders(
      ctx(SUNDAY_2005, {
        resumoSemanal: { on: false, time: '20:00', weekday: 0 },
      }),
    )
    expect(due.some((d) => d.tag === 'resumoSemanal')).toBe(false)
  })

  it('não dispara fora da janela de graça', () => {
    const tooLate = new Date(2026, 10, 15, 20, 40, 0)
    const due = collectDueReminders(
      ctx(tooLate, {
        resumoSemanal: { on: true, time: '20:00', weekday: 0 },
      }),
    )
    expect(due.some((d) => d.tag === 'resumoSemanal')).toBe(false)
  })
})
