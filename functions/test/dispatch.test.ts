import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  dispatchForUser,
  isTrustedEndpoint,
  wallClock,
  type DispatchDeps,
  type PushSub,
  type SendResult,
  type UserPushDoc,
} from '../src/dispatch'

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123'

const sub = (id = 'a') =>
  ({
    [id]: { endpoint: ENDPOINT + id, p256dh: 'p', auth: 'a' },
  }) as UserPushDoc['subscriptions']

/** 2026-11-09 é segunda-feira. 21:05 UTC = 18:05 em São Paulo (UTC-3). */
const MONDAY_1805_SP = new Date('2026-11-09T21:05:00Z')

function deps(
  states: Record<string, unknown>,
  result: SendResult = 'ok',
): DispatchDeps & { sentPayloads: string[] } {
  const sentPayloads: string[] = []
  return {
    sentPayloads,
    loadStates: async (names) =>
      Object.fromEntries(names.map((n) => [n, states[n]])),
    send: async (_sub: PushSub, payload: string) => {
      sentPayloads.push(payload)
      return result
    },
  }
}

const treinoSeg = {
  plan: [
    {
      id: 't1',
      name: 'Push',
      focus: 'Peito, ombro e tríceps',
      dayOfWeek: 1,
      estimatedMin: 60,
      exercises: [],
    },
  ],
  weekDone: {},
  active: null,
}

function doc(extra: Partial<UserPushDoc> = {}): UserPushDoc {
  return {
    enabled: true,
    tz: 'America/Sao_Paulo',
    subscriptions: sub(),
    settings: {
      enabled: true,
      treino: { on: true, time: '18:00' },
      agua: { on: false },
      habitos: { on: false },
      contas: { on: false },
    },
    ...extra,
  }
}

describe('wallClock', () => {
  it('converte o instante para a hora do utilizador', () => {
    const w = wallClock(MONDAY_1805_SP, 'America/Sao_Paulo')
    assert.equal(w.getHours(), 18)
    assert.equal(w.getMinutes(), 5)
    assert.equal(w.getDay(), 1)
  })

  it('cruza a meia-noite para o dia certo', () => {
    // 02:30 UTC de terça = 23:30 de segunda em São Paulo
    const w = wallClock(new Date('2026-11-10T02:30:00Z'), 'America/Sao_Paulo')
    assert.equal(w.getDay(), 1)
    assert.equal(w.getHours(), 23)
  })

  it('usa o fuso padrão se o fuso for inválido', () => {
    const w = wallClock(MONDAY_1805_SP, 'Isto/Nao-Existe')
    assert.equal(w.getHours(), 18)
  })
})

describe('isTrustedEndpoint', () => {
  it('aceita serviços de push conhecidos', () => {
    assert.ok(isTrustedEndpoint('https://fcm.googleapis.com/fcm/send/x'))
    assert.ok(isTrustedEndpoint('https://web.push.apple.com/x'))
    assert.ok(isTrustedEndpoint('https://updates.push.services.mozilla.com/x'))
    assert.ok(isTrustedEndpoint('https://wns2-par02p.notify.windows.com/x'))
  })

  it('recusa destinos arbitrários', () => {
    assert.ok(!isTrustedEndpoint('http://fcm.googleapis.com/x'))
    assert.ok(!isTrustedEndpoint('https://evil.example.com/x'))
    assert.ok(!isTrustedEndpoint('https://fcm.googleapis.com.evil.com/x'))
    assert.ok(!isTrustedEndpoint('http://169.254.169.254/latest'))
    assert.ok(!isTrustedEndpoint(undefined))
  })
})

describe('dispatchForUser', () => {
  it('envia o treino na hora e marca como enviado', async () => {
    const d = deps({ treino: treinoSeg })
    const out = await dispatchForUser(MONDAY_1805_SP, doc(), d)
    assert.deepEqual(out.delivered, ['treino:2026-11-09'])
    assert.equal(d.sentPayloads.length, 1)
    const payload = JSON.parse(d.sentPayloads[0])
    assert.equal(payload.url, '/treino')
    assert.match(payload.body, /Push/)
    assert.ok(out.sent?.['treino:2026-11-09'])
  })

  it('não repete um aviso já enviado', async () => {
    const d = deps({ treino: treinoSeg })
    const out = await dispatchForUser(
      MONDAY_1805_SP,
      doc({ sent: { 'treino:2026-11-09': 1 } }),
      d,
    )
    assert.deepEqual(out.delivered, [])
    assert.equal(d.sentPayloads.length, 0)
  })

  it('não avisa se o treino de hoje já foi feito', async () => {
    const d = deps({
      treino: { ...treinoSeg, weekDone: { '2026-11-09': 't1' } },
    })
    const out = await dispatchForUser(MONDAY_1805_SP, doc(), d)
    assert.deepEqual(out.delivered, [])
  })

  it('não avisa fora da janela de tolerância', async () => {
    const d = deps({ treino: treinoSeg })
    // 18:30 em São Paulo — passaram 30 min
    const out = await dispatchForUser(
      new Date('2026-11-09T21:30:00Z'),
      doc(),
      d,
    )
    assert.deepEqual(out.delivered, [])
  })

  it('não avisa em dia sem treino (terça)', async () => {
    const d = deps({ treino: treinoSeg })
    const out = await dispatchForUser(
      new Date('2026-11-10T21:05:00Z'),
      doc(),
      d,
    )
    assert.deepEqual(out.delivered, [])
  })

  it('não faz nada se estiver desligado', async () => {
    const d = deps({ treino: treinoSeg })
    assert.deepEqual(
      (await dispatchForUser(MONDAY_1805_SP, doc({ enabled: false }), d))
        .delivered,
      [],
    )
    assert.deepEqual(
      (
        await dispatchForUser(
          MONDAY_1805_SP,
          doc({ settings: { enabled: false } }),
          d,
        )
      ).delivered,
      [],
    )
  })

  it('ignora assinaturas com endpoint não confiável', async () => {
    const d = deps({ treino: treinoSeg })
    const out = await dispatchForUser(
      MONDAY_1805_SP,
      doc({
        subscriptions: {
          x: { endpoint: 'https://evil.example.com/p', p256dh: 'p', auth: 'a' },
        },
      }),
      d,
    )
    assert.deepEqual(out.delivered, [])
    assert.equal(d.sentPayloads.length, 0)
  })

  it('reporta assinaturas expiradas e tenta de novo se ninguém recebeu', async () => {
    const d = deps({ treino: treinoSeg }, 'gone')
    const out = await dispatchForUser(MONDAY_1805_SP, doc(), d)
    assert.deepEqual(out.goneSubs, ['a'])
    assert.deepEqual(out.delivered, [])
    assert.equal(out.sent, null)
  })

  it('não marca como enviado se o envio falhar (volta a tentar)', async () => {
    const d = deps({ treino: treinoSeg }, 'error')
    const out = await dispatchForUser(MONDAY_1805_SP, doc(), d)
    assert.deepEqual(out.delivered, [])
    assert.equal(out.sent, null)
  })

  it('avisa a água com a meta em falta e para quando a meta é batida', async () => {
    const settings = {
      enabled: true,
      treino: { on: false },
      agua: { on: true, everyMin: 120, from: '08:00', to: '21:00' },
      habitos: { on: false },
      contas: { on: false },
    }
    // 10:05 em São Paulo = 2.ª faixa (08:00, 10:00)
    const at = new Date('2026-11-09T13:05:00Z')
    const falta = deps({
      nutricao: { waterGoal: 2500, waterByDay: { '2026-11-09': 1000 } },
    })
    const a = await dispatchForUser(at, doc({ settings }), falta)
    assert.deepEqual(a.delivered, ['agua:2026-11-09:1'])
    assert.match(JSON.parse(falta.sentPayloads[0]).body, /1,5 L/)

    const batida = deps({
      nutricao: { waterGoal: 2500, waterByDay: { '2026-11-09': 2600 } },
    })
    const b = await dispatchForUser(at, doc({ settings }), batida)
    assert.deepEqual(b.delivered, [])
  })

  it('avisa hábito na hora do lembrete e respeita o já feito', async () => {
    const settings = {
      enabled: true,
      treino: { on: false },
      agua: { on: false },
      habitos: { on: true, streakGuard: false },
      contas: { on: false },
    }
    const habit = {
      id: 'h1',
      name: 'Ler 10 páginas',
      detail: '',
      frequency: 'daily',
      customDays: [],
      reminderEnabled: true,
      reminderTime: '18:00',
      streak: 6,
      lastDoneDateKey: '2026-11-08',
      lastSkipDateKey: null,
    }
    const pendente = deps({ habitos: { habits: [habit] } })
    const a = await dispatchForUser(MONDAY_1805_SP, doc({ settings }), pendente)
    assert.deepEqual(a.delivered, ['habito:h1:2026-11-09'])
    assert.match(JSON.parse(pendente.sentPayloads[0]).body, /6 dias/)

    const feito = deps({
      habitos: { habits: [{ ...habit, lastDoneDateKey: '2026-11-09' }] },
    })
    const b = await dispatchForUser(MONDAY_1805_SP, doc({ settings }), feito)
    assert.deepEqual(b.delivered, [])
  })
})
