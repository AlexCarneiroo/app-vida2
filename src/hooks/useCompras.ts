import { useCallback, useMemo } from 'react'
import {
  checkedCount,
  cloneListAsActive,
  createNeededItem,
  createShoppingItem,
  createShoppingList,
  emptyComprasState,
  estimatedListTotal,
  pendingCount,
  productMemoryKey,
} from '../data/comprasDefaults'
import { loadComprasPersisted } from '../lib/persist'
import type {
  ComprasState,
  NeededItem,
  ShoppingAisle,
  ShoppingItem,
  ShoppingList,
} from '../types/compras'
import { useCloudSyncedState } from './useCloudSyncedState'

const STORAGE_KEY = 'vida.compras.v1'

function loadDoc() {
  return loadComprasPersisted(STORAGE_KEY, emptyComprasState())
}

const isEmpty = (d: ComprasState) =>
  d.needed.length === 0 && d.lists.length === 0

export function useCompras() {
  const { state, update } = useCloudSyncedState<ComprasState>({
    collection: 'compras',
    storageKey: STORAGE_KEY,
    load: loadDoc,
    isEmpty,
  })

  const activeList = useMemo(
    () => state.lists.find((l) => l.id === state.activeListId) ?? null,
    [state.lists, state.activeListId],
  )

  const history = useMemo(
    () =>
      state.lists
        .filter((l) => l.status === 'done')
        .sort((a, b) =>
          (b.completedAt || b.createdAt).localeCompare(
            a.completedAt || a.createdAt,
          ),
        ),
    [state.lists],
  )

  const lastDone = history[0] ?? null

  const addNeeded = useCallback(
    (name: string, note?: string) => {
      const trimmed = name.trim()
      if (!trimmed) return null
      const item = createNeededItem(trimmed, note)
      update((prev) => ({
        ...prev,
        needed: [item, ...prev.needed.filter((n) => n.name.toLowerCase() !== trimmed.toLowerCase())].slice(0, 100),
      }))
      return item.id
    },
    [update],
  )

  const removeNeeded = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        needed: prev.needed.filter((n) => n.id !== id),
      }))
    },
    [update],
  )

  const ensureActiveList = useCallback(
    (title?: string) => {
      let createdId: string | null = null
      update((prev) => {
        const current = prev.lists.find((l) => l.id === prev.activeListId)
        if (current && current.status === 'active') return prev
        const list = createShoppingList(title)
        createdId = list.id
        return {
          ...prev,
          lists: [list, ...prev.lists].slice(0, 40),
          activeListId: list.id,
        }
      })
      return createdId
    },
    [update],
  )

  const startNewList = useCallback(
    (title?: string) => {
      const list = createShoppingList(title)
      update((prev) => ({
        ...prev,
        lists: [
          list,
          ...prev.lists.map((l) =>
            l.status === 'active' ? { ...l, status: 'done' as const, completedAt: l.completedAt || new Date().toISOString() } : l,
          ),
        ].slice(0, 40),
        activeListId: list.id,
      }))
      return list.id
    },
    [update],
  )

  const addItemToActive = useCallback(
    (input: {
      name: string
      qty?: number
      unit?: string
      estimatedPrice?: number
      aisle?: ShoppingAisle
      fromNeededId?: string
    }) => {
      const trimmed = input.name.trim()
      if (!trimmed) return null
      let createdId: string | null = null
      update((prev) => {
        const item = createShoppingItem({
          ...input,
          name: trimmed,
          aisleMemory: prev.aisleMemory,
        })
        createdId = item.id
        let lists = prev.lists
        let activeListId = prev.activeListId
        let active = lists.find((l) => l.id === activeListId && l.status === 'active')
        if (!active) {
          const list = createShoppingList()
          activeListId = list.id
          lists = [list, ...lists]
          active = list
        }
        const exists = active.items.find(
          (i) => i.name.toLowerCase() === trimmed.toLowerCase() && !i.checked,
        )
        const nextItems = exists
          ? active.items.map((i) =>
              i.id === exists.id
                ? {
                    ...i,
                    qty: (i.qty || 1) + (input.qty && input.qty > 0 ? input.qty : 1),
                  }
                : i,
            )
          : [item, ...active.items]
        return {
          ...prev,
          needed: input.fromNeededId
            ? prev.needed.filter((n) => n.id !== input.fromNeededId)
            : prev.needed,
          activeListId,
          lists: lists
            .map((l) =>
              l.id === activeListId
                ? { ...l, status: 'active' as const, items: nextItems.slice(0, 200) }
                : l,
            )
            .slice(0, 40),
        }
      })
      return createdId
    },
    [update],
  )

  const moveNeededToList = useCallback(
    (ids?: string[]) => {
      update((prev) => {
        const selected = ids?.length
          ? prev.needed.filter((n) => ids.includes(n.id))
          : prev.needed
        if (selected.length === 0) return prev

        let lists = prev.lists
        let activeListId = prev.activeListId
        let active = lists.find((l) => l.id === activeListId && l.status === 'active')
        if (!active) {
          const list = createShoppingList()
          activeListId = list.id
          lists = [list, ...lists]
          active = list
        }

        let items = [...active.items]
        for (const need of selected) {
          const exists = items.find(
            (i) =>
              i.name.toLowerCase() === need.name.toLowerCase() && !i.checked,
          )
          if (exists) {
            items = items.map((i) =>
              i.id === exists.id
                ? { ...i, qty: (i.qty || 1) + 1, fromNeededId: need.id }
                : i,
            )
          } else {
            items = [
              createShoppingItem({
                name: need.name,
                fromNeededId: need.id,
                aisleMemory: prev.aisleMemory,
              }),
              ...items,
            ]
          }
        }

        const movedIds = new Set(selected.map((n) => n.id))
        return {
          ...prev,
          needed: prev.needed.filter((n) => !movedIds.has(n.id)),
          activeListId,
          lists: lists
            .map((l) =>
              l.id === activeListId
                ? { ...l, status: 'active' as const, items: items.slice(0, 200) }
                : l,
            )
            .slice(0, 40),
        }
      })
    },
    [update],
  )

  const toggleItem = useCallback(
    (itemId: string) => {
      update((prev) => ({
        ...prev,
        lists: prev.lists.map((l) =>
          l.id !== prev.activeListId
            ? l
            : {
                ...l,
                items: l.items.map((i) =>
                  i.id === itemId ? { ...i, checked: !i.checked } : i,
                ),
              },
        ),
      }))
    },
    [update],
  )

  const updateItem = useCallback(
    (
      itemId: string,
      patch: Partial<{
        name: string
        qty: number | undefined
        unit: string | undefined
        estimatedPrice: number | undefined
        aisle: ShoppingAisle
      }>,
    ) => {
      update((prev) => {
        let aisleMemory = prev.aisleMemory ?? {}
        const lists = prev.lists.map((l) =>
          l.id !== prev.activeListId
            ? l
            : {
                ...l,
                items: l.items.map((i) => {
                  if (i.id !== itemId) return i
                  const nextName =
                    patch.name !== undefined
                      ? patch.name.trim() || i.name
                      : i.name
                  const nextAisle =
                    patch.aisle !== undefined ? patch.aisle : i.aisle
                  if (patch.aisle !== undefined) {
                    const key = productMemoryKey(nextName)
                    if (key) {
                      aisleMemory = { ...aisleMemory, [key]: patch.aisle }
                    }
                  }
                  return {
                    ...i,
                    name: nextName,
                    qty:
                      patch.qty !== undefined
                        ? patch.qty && patch.qty > 0
                          ? Math.round(patch.qty * 100) / 100
                          : undefined
                        : i.qty,
                    unit:
                      patch.unit !== undefined
                        ? patch.unit.trim() || undefined
                        : i.unit,
                    estimatedPrice:
                      patch.estimatedPrice !== undefined
                        ? patch.estimatedPrice && patch.estimatedPrice > 0
                          ? Math.round(patch.estimatedPrice * 100) / 100
                          : undefined
                        : i.estimatedPrice,
                    aisle: nextAisle,
                  }
                }),
              },
        )
        return { ...prev, lists, aisleMemory }
      })
    },
    [update],
  )

  const removeItem = useCallback(
    (itemId: string) => {
      update((prev) => ({
        ...prev,
        lists: prev.lists.map((l) =>
          l.id !== prev.activeListId
            ? l
            : { ...l, items: l.items.filter((i) => i.id !== itemId) },
        ),
      }))
    },
    [update],
  )

  const redoFromList = useCallback(
    (sourceId?: string) => {
      update((prev) => {
        const source =
          (sourceId
            ? prev.lists.find((l) => l.id === sourceId)
            : null) ||
          prev.lists
            .filter((l) => l.status === 'done')
            .sort((a, b) =>
              (b.completedAt || b.createdAt).localeCompare(
                a.completedAt || a.createdAt,
              ),
            )[0] ||
          prev.lists.find((l) => l.id === prev.activeListId)
        if (!source || source.items.length === 0) return prev
        const next = cloneListAsActive(source)
        return {
          ...prev,
          lists: [
            next,
            ...prev.lists.map((l) =>
              l.status === 'active'
                ? {
                    ...l,
                    status: 'done' as const,
                    completedAt: l.completedAt || new Date().toISOString(),
                  }
                : l,
            ),
          ].slice(0, 40),
          activeListId: next.id,
        }
      })
    },
    [update],
  )

  const completeActiveList = useCallback(
    (input: {
      totalSpent: number
      financeTxId?: string | null
      financeCategory?: 'alimentação' | 'compras'
      returnUncheckedToNeeded?: boolean
    }) => {
      update((prev) => {
        const active = prev.lists.find((l) => l.id === prev.activeListId)
        if (!active || active.status !== 'active') return prev

        const unchecked = active.items.filter((i) => !i.checked)
        let needed = prev.needed
        if (input.returnUncheckedToNeeded && unchecked.length > 0) {
          const extras: NeededItem[] = unchecked.map((i) =>
            createNeededItem(i.name),
          )
          const names = new Set(needed.map((n) => n.name.toLowerCase()))
          needed = [
            ...extras.filter((e) => !names.has(e.name.toLowerCase())),
            ...needed,
          ].slice(0, 100)
        }

        const done: ShoppingList = {
          ...active,
          status: 'done',
          completedAt: new Date().toISOString(),
          totalSpent:
            input.totalSpent > 0
              ? Math.round(input.totalSpent * 100) / 100
              : null,
          financeTxId: input.financeTxId ?? null,
          financeCategory: input.financeCategory ?? null,
        }

        return {
          ...prev,
          needed,
          activeListId: null,
          lists: prev.lists.map((l) => (l.id === done.id ? done : l)),
        }
      })
    },
    [update],
  )

  return {
    state,
    needed: state.needed,
    lists: state.lists,
    activeList,
    history,
    lastDone,
    pending: pendingCount(activeList),
    checked: checkedCount(activeList),
    estimatedTotal: estimatedListTotal(activeList),
    addNeeded,
    removeNeeded,
    ensureActiveList,
    startNewList,
    addItemToActive,
    moveNeededToList,
    toggleItem,
    updateItem,
    removeItem,
    redoFromList,
    completeActiveList,
  }
}

export type { ShoppingItem, ShoppingList, NeededItem }
