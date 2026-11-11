import { importPKCS8, SignJWT } from 'jose'
import type { DataName } from '../../src/lib/reminderEngine'
import type { UserPushDoc } from '../../functions/src/dispatch'

export type Env = {
  FIREBASE_PROJECT_ID: string
  FIREBASE_WEB_API_KEY: string
  FIREBASE_CLIENT_EMAIL: string
  FIREBASE_PRIVATE_KEY: string
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string
}

type FsValue = {
  nullValue?: null
  booleanValue?: boolean
  integerValue?: string
  doubleValue?: number
  timestampValue?: string
  stringValue?: string
  arrayValue?: { values?: FsValue[] }
  mapValue?: { fields?: Record<string, FsValue> }
}

type FsDocument = {
  name: string
  fields?: Record<string, FsValue>
}

let cachedToken: { value: string; until: number } | null = null

async function accessToken(env: Env) {
  if (cachedToken && cachedToken.until > Date.now() + 60_000) {
    return cachedToken.value
  }
  const now = Math.floor(Date.now() / 1000)
  const key = await importPKCS8(
    env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    'RS256',
  )
  const assertion = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/datastore',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(env.FIREBASE_CLIENT_EMAIL)
    .setSubject(env.FIREBASE_CLIENT_EMAIL)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key)

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  if (!response.ok) {
    throw new Error(`OAuth Google ${response.status}`)
  }
  const data = (await response.json()) as {
    access_token: string
    expires_in: number
  }
  cachedToken = {
    value: data.access_token,
    until: Date.now() + data.expires_in * 1000,
  }
  return data.access_token
}

async function googleFetch(
  env: Env,
  path: string,
  init: RequestInit = {},
) {
  const token = await accessToken(env)
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents${path}`,
    {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...init.headers,
      },
    },
  )
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300)
    throw new Error(`Firestore ${response.status}: ${detail}`)
  }
  return response
}

function decode(value: FsValue): unknown {
  if ('nullValue' in value) return null
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('timestampValue' in value) return value.timestampValue
  if ('stringValue' in value) return value.stringValue
  if ('arrayValue' in value) {
    return (value.arrayValue?.values ?? []).map(decode)
  }
  if ('mapValue' in value) {
    return decodeFields(value.mapValue?.fields ?? {})
  }
  return null
}

function decodeFields(fields: Record<string, FsValue>) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decode(value)]),
  )
}

function encode(value: unknown): FsValue {
  if (value == null) return { nullValue: null }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value }
  }
  if (typeof value === 'string') return { stringValue: value }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encode) } }
  }
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([key, item]) => [
            key,
            encode(item),
          ]),
        ),
      },
    }
  }
  return { nullValue: null }
}

export type PushUser = { uid: string; data: UserPushDoc }

export async function enabledPushUsers(env: Env): Promise<PushUser[]> {
  const response = await googleFetch(env, ':runQuery', {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'pushUsers' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'enabled' },
            op: 'EQUAL',
            value: { booleanValue: true },
          },
        },
        limit: 100,
      },
    }),
  })
  const rows = (await response.json()) as Array<{ document?: FsDocument }>
  return rows.flatMap((row) => {
    if (!row.document) return []
    return [
      {
        uid: row.document.name.split('/').at(-1) ?? '',
        data: decodeFields(row.document.fields ?? {}) as UserPushDoc,
      },
    ]
  })
}

export async function getPushUser(
  env: Env,
  uid: string,
): Promise<UserPushDoc | null> {
  const response = await googleFetch(
    env,
    `/pushUsers/${encodeURIComponent(uid)}`,
  )
  const doc = (await response.json()) as FsDocument
  return decodeFields(doc.fields ?? {}) as UserPushDoc
}

export async function loadUserStates(
  env: Env,
  uid: string,
  names: DataName[],
) {
  if (names.length === 0) return {}
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`
  const response = await googleFetch(env, ':batchGet', {
    method: 'POST',
    body: JSON.stringify({
      documents: names.map((name) => `${root}/users/${uid}/app/${name}`),
    }),
  })
  const rows = (await response.json()) as Array<{ found?: FsDocument }>
  const out: Partial<Record<DataName, unknown>> = {}
  for (const row of rows) {
    if (!row.found) continue
    const name = row.found.name.split('/').at(-1) as DataName
    const envelope = decodeFields(row.found.fields ?? {}) as {
      data?: unknown
    }
    out[name] = envelope.data ?? null
  }
  return out
}

export async function updatePushUser(
  env: Env,
  uid: string,
  patch: Pick<UserPushDoc, 'sent' | 'subscriptions'>,
) {
  const params = new URLSearchParams()
  params.append('updateMask.fieldPaths', 'sent')
  params.append('updateMask.fieldPaths', 'subscriptions')
  await googleFetch(
    env,
    `/pushUsers/${encodeURIComponent(uid)}?${params.toString()}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        fields: {
          sent: encode(patch.sent ?? {}),
          subscriptions: encode(patch.subscriptions ?? {}),
        },
      }),
    },
  )
}

export async function markTestSent(env: Env, uid: string, at: number) {
  await googleFetch(
    env,
    `/pushUsers/${encodeURIComponent(uid)}?updateMask.fieldPaths=lastTestAt`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        fields: { lastTestAt: encode(at) },
      }),
    },
  )
}

/** Valida um Firebase ID token pela API oficial do Firebase Auth. */
export async function verifyFirebaseUser(env: Env, idToken: string) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  )
  if (!response.ok) return null
  const data = (await response.json()) as {
    users?: Array<{ localId?: string }>
  }
  return data.users?.[0]?.localId ?? null
}
