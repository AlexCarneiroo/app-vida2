/* Notificações do VIDA — carregado pelo service worker gerado (workbox.importScripts). */

const INBOX_DB = 'vida.notifications.v1'
const INBOX_STORE = 'inbox'

function openInbox() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(INBOX_DB, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(INBOX_STORE)) {
        const store = db.createObjectStore(INBOX_STORE, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function notifyInboxClients() {
  const windows = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })
  for (const client of windows) {
    client.postMessage({ type: 'vida:inbox-updated' })
  }
}

async function saveInbox(payload) {
  const createdAt = Number(payload.createdAt) || Date.now()
  const id =
    payload.id ||
    `${payload.tag || 'push'}:${createdAt}:${Math.random().toString(36).slice(2, 7)}`
  const db = await openInbox()
  await new Promise((resolve, reject) => {
    const request = db
      .transaction(INBOX_STORE, 'readwrite')
      .objectStore(INBOX_STORE)
      .put({
        id,
        title: payload.title || 'VIDA',
        body: payload.body || '',
        url: payload.url || '/',
        tag: payload.tag || 'vida',
        createdAt,
        read: false,
      })
    request.onsuccess = resolve
    request.onerror = () => reject(request.error)
  })
  db.close()
  await notifyInboxClients()
  return id
}

async function markInboxRead(id) {
  if (!id) return
  const db = await openInbox()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(INBOX_STORE, 'readwrite')
    const store = tx.objectStore(INBOX_STORE)
    const get = store.get(id)
    get.onsuccess = () => {
      if (get.result) store.put({ ...get.result, read: true })
    }
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  await notifyInboxClients()
}

// Toque numa notificação: foca o app (e abre a página certa) ou abre uma janela nova.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  const inboxId =
    event.notification.data && event.notification.data.inboxId

  event.waitUntil(
    (async () => {
      await markInboxRead(inboxId)
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus()
          client.postMessage({ type: 'vida:navigate', url })
          return
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url)
    })(),
  )
})

// Push vindo de servidor (fase 2: FCM / Web Push). Já fica pronto para receber
// { "title": "...", "body": "...", "url": "/treino", "tag": "treino" }.
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data ? event.data.text() : '' }
  }
  const title = payload.title || 'VIDA'
  event.waitUntil(
    (async () => {
      const inboxId = await saveInbox(payload)
      await self.registration.showNotification(title, {
        body: payload.body || '',
        tag: payload.tag,
        icon: '/pwa-192.png',
        badge: '/pwa-192.png',
        lang: 'pt-BR',
        data: { url: payload.url || '/', inboxId },
      })
    })(),
  )
})
