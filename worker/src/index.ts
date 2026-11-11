import { buildPushPayload } from '@block65/webcrypto-web-push'
import {
  dispatchForUser,
  isTrustedEndpoint,
  type PushSub,
  type SendResult,
  type UserPushDoc,
} from '../../functions/src/dispatch'
import {
  enabledPushUsers,
  getPushUser,
  loadUserStates,
  markTestSent,
  updatePushUser,
  verifyFirebaseUser,
  type Env,
} from './firestore'

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  }
}

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: cors() })
}

async function sendPush(
  env: Env,
  sub: PushSub,
  data: string,
): Promise<SendResult> {
  try {
    const request = await buildPushPayload(
      { data, options: { ttl: 15 * 60 } },
      {
        endpoint: sub.endpoint,
        expirationTime: null,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      {
        subject: env.VAPID_SUBJECT,
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
      },
    )
    const response = await fetch(sub.endpoint, request)
    if (response.ok) return 'ok'
    if (response.status === 404 || response.status === 410) return 'gone'
    console.warn('[push]', response.status, await response.text())
    return 'error'
  } catch (error) {
    console.warn('[push]', error)
    return 'error'
  }
}

async function runReminders(env: Env, instant: Date) {
  const users = await enabledPushUsers(env)
  let delivered = 0

  for (const user of users) {
    try {
      const outcome = await dispatchForUser(instant, user.data, {
        loadStates: (names) => loadUserStates(env, user.uid, names),
        send: (sub, payload) => sendPush(env, sub, payload),
      })
      if (outcome.sent || outcome.goneSubs.length > 0) {
        const subscriptions = { ...(user.data.subscriptions ?? {}) }
        for (const id of outcome.goneSubs) delete subscriptions[id]
        await updatePushUser(env, user.uid, {
          sent: outcome.sent ?? user.data.sent ?? {},
          subscriptions,
        })
      }
      delivered += outcome.delivered.length
    } catch (error) {
      console.error(`[push] utilizador ${user.uid}`, error)
    }
  }
  console.log(`[push] ${users.length} utilizadores, ${delivered} avisos`)
  return { users: users.length, delivered }
}

async function testPush(request: Request, env: Env) {
  const bearer = request.headers.get('authorization') ?? ''
  const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : ''
  const uid = token ? await verifyFirebaseUser(env, token) : null
  if (!uid) return json({ error: 'unauthorized' }, 401)

  const data = (await getPushUser(env, uid)) as UserPushDoc & {
    lastTestAt?: number
  }
  const now = Date.now()
  if (data.lastTestAt && now - data.lastTestAt < 10_000) {
    return json({ error: 'too-many-requests' }, 429)
  }
  const entries = Object.entries(data.subscriptions ?? {}).filter(
    (entry): entry is [string, PushSub] =>
      isTrustedEndpoint(entry[1]?.endpoint) &&
      typeof entry[1]?.p256dh === 'string' &&
      typeof entry[1]?.auth === 'string',
  )
  if (entries.length === 0) {
    return json({ error: 'no-subscription' }, 409)
  }

  const payload = JSON.stringify({
    title: 'VIDA · push do servidor ✅',
    body: 'Funciona mesmo com o app fechado!',
    url: '/config',
    tag: 'teste-servidor',
  })
  const results = await Promise.all(
    entries.slice(0, 5).map(async ([id, sub]) => ({
      id,
      result: await sendPush(env, sub, payload),
    })),
  )
  const subscriptions = { ...(data.subscriptions ?? {}) }
  for (const result of results) {
    if (result.result === 'gone') delete subscriptions[result.id]
  }
  await updatePushUser(env, uid, {
    sent: data.sent ?? {},
    subscriptions,
  })
  await markTestSent(env, uid, now)
  return json({
    sent: results.filter((item) => item.result === 'ok').length,
    failed: results.filter((item) => item.result !== 'ok').length,
  })
}

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ) {
    await runReminders(env, new Date(controller.scheduledTime))
  },

  async fetch(request: Request, env: Env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors() })
    }
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, service: 'vida-push' })
    }
    if (request.method === 'POST' && url.pathname === '/test') {
      return testPush(request, env)
    }
    return json({ error: 'not-found' }, 404)
  },
} satisfies ExportedHandler<Env>
