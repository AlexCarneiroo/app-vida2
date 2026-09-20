import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore'
import { onAuthStateChanged, type Auth, type User } from 'firebase/auth'
import { auth, db, firebaseReady } from './firebase'
import { loadJson, saveJson } from './storage'
import {
  SCHEMA_VERSION,
  type CloudCollection,
  type PersistedDoc,
} from './dataVersion'
import {
  mergeFinancasSafe,
  mergeHabitosSafe,
  mergeRotinaSafe,
  mergeTreinoSafe,
  migrateFinancasDoc,
  migrateHabitosDoc,
  migrateRotinaDoc,
  migrateTreinoDoc,
} from './migrate'
import type { FinancasState } from '../types/financas'
import type { HabitosState } from '../types/habitos'
import type { RotinaState } from '../types/rotina'
import type { TreinoState } from '../types/treino'

type AppModuleState = TreinoState | FinancasState | HabitosState | RotinaState

type SyncMeta = {
  treinoUpdatedAt: number
  financasUpdatedAt: number
  habitosUpdatedAt: number
  rotinaUpdatedAt: number
  uid: string | null
  schemaVersion: number
}

const META_KEY = 'vida.sync.meta.v1'
const DEVICE_KEY = 'vida.deviceId'

const timers: Partial<Record<CloudCollection, number>> = {}
const pendingAt: Partial<Record<CloudCollection, number>> = {}
let authPromise: Promise<User | null> | null = null
let currentUser: User | null = null

export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'offline' | 'error'

type StatusListener = (status: SyncStatus, detail?: string) => void
const statusListeners = new Set<StatusListener>()

let lastStatus: SyncStatus = 'idle'

function emitStatus(status: SyncStatus, detail?: string) {
  lastStatus = status
  statusListeners.forEach((fn) => fn(status, detail))
}

export function getSyncStatus() {
  return lastStatus
}

export function subscribeSyncStatus(listener: StatusListener) {
  statusListeners.add(listener)
  listener(lastStatus)
  return () => statusListeners.delete(listener)
}

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

function readMeta(): SyncMeta {
  return loadJson<SyncMeta>(META_KEY, {
    treinoUpdatedAt: 0,
    financasUpdatedAt: 0,
    habitosUpdatedAt: 0,
    rotinaUpdatedAt: 0,
    uid: null,
    schemaVersion: SCHEMA_VERSION,
  })
}

function writeMeta(patch: Partial<SyncMeta>) {
  saveJson(META_KEY, { ...readMeta(), ...patch, schemaVersion: SCHEMA_VERSION })
}

function requireFirebase(): { auth: Auth; db: Firestore } | null {
  if (!firebaseReady || !auth || !db) return null
  return { auth, db }
}

export function ensureCloudUser(): Promise<User | null> {
  const fb = requireFirebase()
  if (!fb) return Promise.resolve(null)
  if (fb.auth.currentUser) {
    currentUser = fb.auth.currentUser
    writeMeta({ uid: currentUser.uid })
    return Promise.resolve(currentUser)
  }
  if (currentUser) return Promise.resolve(currentUser)
  if (authPromise) return authPromise

  authPromise = new Promise((resolve) => {
    const unsub = onAuthStateChanged(fb.auth, (user) => {
      currentUser = user
      if (user) writeMeta({ uid: user.uid })
      authPromise = null
      unsub()
      resolve(user)
    })
  })

  return authPromise
}

export function setCloudUser(user: User | null) {
  currentUser = user
  if (user) writeMeta({ uid: user.uid })
  authPromise = null
}

function cloudRef(collection: CloudCollection, uid: string) {
  const fb = requireFirebase()
  if (!fb) return null
  return doc(fb.db, 'users', uid, 'app', collection)
}

function migrateCloudEnvelope(
  collection: CloudCollection,
  raw: unknown,
): PersistedDoc<AppModuleState> | null {
  if (!raw || typeof raw !== 'object') return null
  switch (collection) {
    case 'treino':
      return migrateTreinoDoc(raw)
    case 'financas':
      return migrateFinancasDoc(raw)
    case 'habitos':
      return migrateHabitosDoc(raw)
    case 'rotina':
      return migrateRotinaDoc(raw)
  }
}

export async function pullCloudDoc(
  collection: CloudCollection,
): Promise<PersistedDoc<AppModuleState> | null> {
  const user = await ensureCloudUser()
  if (!user) return null
  const ref = cloudRef(collection, user.uid)
  if (!ref) return null

  try {
    emitStatus('syncing')
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      emitStatus('idle')
      return null
    }
    const migrated = migrateCloudEnvelope(collection, snap.data())
    emitStatus('saved')
    return migrated
  } catch (err) {
    console.error(`[firebase] pull ${collection}`, err)
    emitStatus('error', 'Falha ao ler na nuvem')
    return null
  }
}

/**
 * Grava só se a nossa versão for >= à da nuvem.
 * Assim uma atualização antiga nunca corrompe dados mais novos.
 */
export async function pushCloudDoc<T>(
  collection: CloudCollection,
  data: T,
  updatedAt = Date.now(),
): Promise<'saved' | 'skipped' | 'error'> {
  const user = await ensureCloudUser()
  if (!user) {
    emitStatus(navigator.onLine ? 'error' : 'offline')
    return 'error'
  }
  const ref = cloudRef(collection, user.uid)
  if (!ref) return 'error'

  try {
    emitStatus('syncing')
    const snap = await getDoc(ref)
    if (snap.exists()) {
      const remote = snap.data() as { updatedAt?: number }
      if (
        typeof remote.updatedAt === 'number' &&
        remote.updatedAt > updatedAt
      ) {
        // nuvem mais nova — não sobrescrever
        writeMeta({
          [`${collection}UpdatedAt`]: remote.updatedAt,
        } as Partial<SyncMeta>)
        emitStatus('saved')
        return 'skipped'
      }
    }

    const payload = {
      schemaVersion: SCHEMA_VERSION,
      data,
      updatedAt,
      deviceId: getDeviceId(),
      savedAt: serverTimestamp(),
    }
    await setDoc(ref, payload, { merge: false })
    writeMeta({
      [`${collection}UpdatedAt`]: updatedAt,
    } as Partial<SyncMeta>)
    emitStatus('saved')
    return 'saved'
  } catch (err) {
    console.error(`[firebase] push ${collection}`, err)
    emitStatus(
      navigator.onLine ? 'error' : 'offline',
      'Falha ao guardar na nuvem',
    )
    return 'error'
  }
}

export function scheduleCloudSave<T>(
  collection: CloudCollection,
  data: T,
  updatedAt = Date.now(),
  debounceMs = 900,
) {
  if (!requireFirebase()) return
  if (typeof window === 'undefined') return

  writeMeta({
    [`${collection}UpdatedAt`]: updatedAt,
  } as Partial<SyncMeta>)
  pendingAt[collection] = updatedAt

  window.clearTimeout(timers[collection])
  timers[collection] = window.setTimeout(() => {
    const at = pendingAt[collection] ?? updatedAt
    void pushCloudDoc(collection, data, at)
  }, debounceMs)
}

export async function hydrateFromCloud<T extends AppModuleState>(
  collection: CloudCollection,
  localDoc: PersistedDoc<T>,
  isEmpty: (data: T) => boolean,
): Promise<PersistedDoc<T>> {
  if (!requireFirebase()) return localDoc
  if (!navigator.onLine) {
    emitStatus('offline')
    return localDoc
  }

  const cloud = await pullCloudDoc(collection)
  if (!cloud) {
    if (!isEmpty(localDoc.data)) {
      await pushCloudDoc(collection, localDoc.data, localDoc.updatedAt || Date.now())
    }
    return localDoc
  }

  const cloudTyped = cloud as PersistedDoc<T>
  // Offline-first: se o local for mais recente ou igual, não deixar a nuvem apagar
  const preferRemote = cloudTyped.updatedAt > localDoc.updatedAt

  let mergedData: T
  switch (collection) {
    case 'financas':
      mergedData = mergeFinancasSafe(
        localDoc.data as FinancasState,
        cloudTyped.data as FinancasState,
        preferRemote,
      ) as T
      break
    case 'habitos':
      mergedData = mergeHabitosSafe(
        localDoc.data as HabitosState,
        cloudTyped.data as HabitosState,
        preferRemote,
      ) as T
      break
    case 'rotina':
      mergedData = mergeRotinaSafe(
        localDoc.data as RotinaState,
        cloudTyped.data as RotinaState,
        preferRemote,
      ) as T
      break
    default:
      mergedData = mergeTreinoSafe(
        localDoc.data as TreinoState,
        cloudTyped.data as TreinoState,
        preferRemote,
      ) as T
  }

  const mergedAt = Math.max(
    localDoc.updatedAt || 0,
    cloudTyped.updatedAt || 0,
    Date.now(),
  )
  const merged: PersistedDoc<T> = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: mergedAt,
    data: mergedData,
  }

  writeMeta({
    [`${collection}UpdatedAt`]: mergedAt,
  } as Partial<SyncMeta>)

  const remoteJson = JSON.stringify(cloudTyped.data)
  const mergedJson = JSON.stringify(mergedData)
  const localJson = JSON.stringify(localDoc.data)

  // Se o local trouxe algo que a nuvem não tem, ou merge ≠ remote → sobe
  if (
    (mergedJson !== remoteJson || localJson !== remoteJson) &&
    !isEmpty(mergedData)
  ) {
    const pushAt = Math.max(mergedAt, Date.now())
    await pushCloudDoc(collection, mergedData, pushAt)
    return { ...merged, updatedAt: pushAt }
  }

  return merged
}

export function flushCloudSave<T>(
  collection: CloudCollection,
  data: T,
  updatedAt = Date.now(),
) {
  window.clearTimeout(timers[collection])
  return pushCloudDoc(collection, data, updatedAt)
}

export type { TreinoState, FinancasState, HabitosState, RotinaState, PersistedDoc }
