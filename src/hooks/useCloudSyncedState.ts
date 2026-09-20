import { useCallback, useEffect, useRef, useState } from 'react'
import {
  flushCloudSave,
  hydrateFromCloud,
  scheduleCloudSave,
} from '../lib/cloudSync'
import { type CloudCollection, type PersistedDoc } from '../lib/dataVersion'
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
  const hydratingRef = useRef(false)
  const stateRef = useRef(state)
  const updatedAtRef = useRef(load().updatedAt)
  stateRef.current = state

  useEffect(() => {
    if (!authReady) return
    let cancelled = false
    hydratedRef.current = false
    hydratingRef.current = true
    ;(async () => {
      const localAtStart = load()
      const next = await hydrateFromCloud(collection, localAtStart, isEmpty)
      if (cancelled) return

      // Edições offline durante o pull: o localStorage pode estar mais novo
      const latestLocal = load()
      let finalDoc = next
      if (
        latestLocal.updatedAt > localAtStart.updatedAt &&
        latestLocal.updatedAt >= next.updatedAt
      ) {
        finalDoc = await hydrateFromCloud(collection, latestLocal, isEmpty)
      }

      if (cancelled) return
      setState(finalDoc.data)
      updatedAtRef.current = finalDoc.updatedAt
      touchPersisted(storageKey, finalDoc.data, finalDoc.updatedAt)
      hydratedRef.current = true
      hydratingRef.current = false
    })()
    return () => {
      cancelled = true
      hydratingRef.current = false
    }
  }, [uid, authReady, collection, storageKey, load, isEmpty])

  useEffect(() => {
    // Sempre grava local com timestamp novo — offline-first
    const at = Date.now()
    updatedAtRef.current = at
    touchPersisted(storageKey, state, at)
    if (hydratedRef.current && !hydratingRef.current) {
      scheduleCloudSave(collection, state, at)
    }
  }, [state, collection, storageKey])

  useEffect(() => {
    const flush = () => {
      const at = updatedAtRef.current || Date.now()
      touchPersisted(storageKey, stateRef.current, at)
      if (!hydratedRef.current) return
      void flushCloudSave(collection, stateRef.current, at)
    }
    const onOnline = () => {
      window.setTimeout(flush, 400)
    }
    window.addEventListener('pagehide', flush)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('online', onOnline)
    }
  }, [collection, storageKey])

  const update = useCallback((updater: (prev: T) => T) => {
    setState(updater)
  }, [])

  return { state, setState, update }
}
