import { useCallback, useEffect, useRef, useState } from 'react'
import {
  flushCloudSave,
  hydrateFromCloud,
  scheduleCloudSave,
} from '../lib/cloudSync'
import {
  SCHEMA_VERSION,
  type CloudCollection,
  type PersistedDoc,
} from '../lib/dataVersion'
import { touchPersisted } from '../lib/persist'
import { useAuth } from './useAuth'
import type { FinancasState } from '../types/financas'
import type { HabitosState } from '../types/habitos'
import type { RotinaState } from '../types/rotina'
import type { TreinoState } from '../types/treino'

type AppModuleState = TreinoState | FinancasState | HabitosState | RotinaState

type Options<T extends AppModuleState> = {
  collection: CloudCollection
  storageKey: string
  load: () => PersistedDoc<T>
  isEmpty: (data: T) => boolean
}

export function useCloudSyncedState<T extends AppModuleState>({
  collection,
  storageKey,
  load,
  isEmpty,
}: Options<T>) {
  const { uid, ready: authReady } = useAuth()
  const [state, setState] = useState<T>(() => load().data)
  const hydratedRef = useRef(false)
  const stateRef = useRef(state)
  const updatedAtRef = useRef(load().updatedAt)
  stateRef.current = state

  useEffect(() => {
    if (!authReady) return
    let cancelled = false
    hydratedRef.current = false
    ;(async () => {
      const local = load()
      const next = await hydrateFromCloud(collection, local, isEmpty)
      if (cancelled) return
      setState(next.data)
      updatedAtRef.current = next.updatedAt
      touchPersisted(storageKey, next)
      hydratedRef.current = true
    })()
    return () => {
      cancelled = true
    }
  }, [uid, authReady, collection, storageKey, load, isEmpty])

  useEffect(() => {
    const at = hydratedRef.current
      ? Date.now()
      : updatedAtRef.current || Date.now()
    if (hydratedRef.current) updatedAtRef.current = at
    touchPersisted(storageKey, {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: at,
      data: state,
    })
    if (hydratedRef.current) scheduleCloudSave(collection, state, at)
  }, [state, collection, storageKey])

  useEffect(() => {
    const flush = () => {
      if (!hydratedRef.current) return
      void flushCloudSave(collection, stateRef.current, updatedAtRef.current)
    }
    window.addEventListener('pagehide', flush)
    window.addEventListener('online', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('online', flush)
    }
  }, [collection])

  const update = useCallback((updater: (prev: T) => T) => {
    setState(updater)
  }, [])

  return { state, setState, update }
}
