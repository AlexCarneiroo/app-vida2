import { useCallback, useEffect, useRef, useState } from 'react'
import {
  flushCloudSave,
  hydrateFromCloud,
  scheduleCloudSave,
} from '../lib/cloudSync'
import { type CloudCollection, type PersistedDoc } from '../lib/dataVersion'
import { touchPersisted } from '../lib/persist'
import { useAuth } from './useAuth'
import type { AgendaState } from '../types/agenda'
import type { ComprasState } from '../types/compras'
import type { FinancasState } from '../types/financas'
import type { HabitosState } from '../types/habitos'
import type { JogosState } from '../types/jogos'
import type { NutricaoState } from '../types/nutricao'
import type { RotinaState } from '../types/rotina'
import type { SaudeState } from '../types/saude'
import type { TreinoState } from '../types/treino'

type AppModuleState =
  | TreinoState
  | FinancasState
  | HabitosState
  | RotinaState
  | NutricaoState
  | SaudeState
  | JogosState
  | AgendaState
  | ComprasState

type Options<T extends AppModuleState> = {
  collection: CloudCollection
  storageKey: string
  load: () => PersistedDoc<T>
  isEmpty: (data: T) => boolean
}

function announceModuleWrite(storageKey: string, updatedAt: number) {
  window.dispatchEvent(
    new CustomEvent('vida:module-external', {
      detail: { storageKey, updatedAt },
    }),
  )
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
  const skipPersistRef = useRef(false)
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

      // Edições durante o pull: o merge da nuvem usa Date.now() no updatedAt,
      // por isso NÃO comparar com next.updatedAt (apagava água/hábitos recentes).
      const latestLocal = load()
      let finalDoc = next
      if (latestLocal.updatedAt > localAtStart.updatedAt) {
        finalDoc = await hydrateFromCloud(collection, latestLocal, isEmpty)
      }

      if (cancelled) return
      skipPersistRef.current = true
      setState(finalDoc.data)
      updatedAtRef.current = finalDoc.updatedAt
      touchPersisted(storageKey, finalDoc.data, finalDoc.updatedAt)
      hydratedRef.current = true
      hydratingRef.current = false
      if (!isEmpty(finalDoc.data)) {
        void flushCloudSave(collection, finalDoc.data, finalDoc.updatedAt)
      }
    })()
    return () => {
      cancelled = true
      hydratingRef.current = false
    }
  }, [uid, authReady, collection, storageKey, load, isEmpty])

  useEffect(() => {
    // Outra instância do mesmo hook (ex.: Home + useSaude) já gravou mais
    // recente — adota e não volta a escrever um snapshot velho.
    if (skipPersistRef.current) {
      skipPersistRef.current = false
      return
    }
    const disk = load()
    if (disk.updatedAt > updatedAtRef.current) {
      skipPersistRef.current = true
      updatedAtRef.current = disk.updatedAt
      setState(disk.data)
      return
    }

    const at = Date.now()
    updatedAtRef.current = at
    touchPersisted(storageKey, state, at)
    announceModuleWrite(storageKey, at)
    // Durante o hydrate inicial, não sobe para a nuvem (evita corrida),
    // mas o localStorage fica sempre atualizado para os lembretes lerem.
    if (hydratedRef.current && !hydratingRef.current) {
      scheduleCloudSave(collection, state, at, 280)
    }
  }, [state, collection, storageKey, load])

  useEffect(() => {
    const flush = () => {
      const disk = load()
      // Não sobrescrever água/hábitos gravados por outra instância.
      if (disk.updatedAt > updatedAtRef.current) return
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
  }, [collection, storageKey, load])

  useEffect(() => {
    const onExternal = (event: Event) => {
      const detail = (event as CustomEvent<{ storageKey?: string }>).detail
      if (detail?.storageKey !== storageKey) return
      const doc = load()
      // `<=`: evita eco da própria gravação (announceModuleWrite).
      if (doc.updatedAt <= updatedAtRef.current) return
      updatedAtRef.current = doc.updatedAt
      skipPersistRef.current = true
      setState(doc.data)
    }
    window.addEventListener('vida:module-external', onExternal)
    return () => window.removeEventListener('vida:module-external', onExternal)
  }, [storageKey, load])

  const update = useCallback((updater: (prev: T) => T) => {
    setState(updater)
  }, [])

  return { state, setState, update }
}
