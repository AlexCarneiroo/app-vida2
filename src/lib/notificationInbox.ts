import { useCallback, useEffect, useState } from 'react'
import type { Notice } from './notifSettings'

export type InboxNotice = {
  id: string
  title: string
  body: string
  url: string
  tag: string
  createdAt: number
  read: boolean
}

const DB_NAME = 'vida.notifications.v1'
const STORE = 'inbox'
const MAX_ITEMS = 80
const channel =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('vida-notifications')
    : null

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function announce() {
  channel?.postMessage('updated')
  window.dispatchEvent(new Event('vida:inbox-updated'))
}

export async function listInboxNotices(): Promise<InboxNotice[]> {
  if (!('indexedDB' in window)) return []
  try {
    const db = await openDb()
    const items = await requestResult(
      db.transaction(STORE, 'readonly').objectStore(STORE).getAll(),
    )
    db.close()
    return (items as InboxNotice[])
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_ITEMS)
  } catch {
    return []
  }
}

export async function addInboxNotice(
  notice: Notice & { id?: string; createdAt?: number },
) {
  if (!('indexedDB' in window)) return
  try {
    const db = await openDb()
    const createdAt = notice.createdAt ?? Date.now()
    const entry: InboxNotice = {
      id:
        notice.id ??
        `${notice.tag || 'notice'}:${createdAt}:${Math.random().toString(36).slice(2, 7)}`,
      title: notice.title,
      body: notice.body,
      url: notice.url ?? '/',
      tag: notice.tag ?? 'vida',
      createdAt,
      read: false,
    }
    await requestResult(
      db.transaction(STORE, 'readwrite').objectStore(STORE).put(entry),
    )
    db.close()
    announce()
  } catch {
    // A notificação do sistema continua a funcionar mesmo sem IndexedDB.
  }
}

export async function markInboxNoticeRead(id: string) {
  try {
    const db = await openDb()
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE)
    const entry = (await requestResult(store.get(id))) as
      | InboxNotice
      | undefined
    if (entry && !entry.read) {
      await requestResult(store.put({ ...entry, read: true }))
    }
    db.close()
    announce()
  } catch {
    // ignora
  }
}

export async function markAllInboxRead() {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const cursor = tx.objectStore(STORE).openCursor()
      cursor.onsuccess = () => {
        const current = cursor.result
        if (!current) return
        const item = current.value as InboxNotice
        if (!item.read) current.update({ ...item, read: true })
        current.continue()
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
    announce()
  } catch {
    // ignora
  }
}

export async function clearInboxNotices() {
  try {
    const db = await openDb()
    await requestResult(
      db.transaction(STORE, 'readwrite').objectStore(STORE).clear(),
    )
    db.close()
    announce()
  } catch {
    // ignora
  }
}

export function useNotificationInbox() {
  const [items, setItems] = useState<InboxNotice[]>([])

  const refresh = useCallback(() => {
    void listInboxNotices().then(setItems)
  }, [])

  useEffect(() => {
    refresh()
    const onMessage = () => refresh()
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'vida:inbox-updated') refresh()
    }
    channel?.addEventListener('message', onMessage)
    window.addEventListener('vida:inbox-updated', onMessage)
    navigator.serviceWorker?.addEventListener('message', onSwMessage)
    return () => {
      channel?.removeEventListener('message', onMessage)
      window.removeEventListener('vida:inbox-updated', onMessage)
      navigator.serviceWorker?.removeEventListener('message', onSwMessage)
    }
  }, [refresh])

  return {
    items,
    unread: items.filter((item) => !item.read).length,
    refresh,
    markRead: markInboxNoticeRead,
    markAllRead: markAllInboxRead,
    clear: clearInboxNotices,
  }
}
