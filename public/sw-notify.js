/* Notificações do VIDA — carregado pelo service worker gerado (workbox.importScripts). */

// Toque numa notificação: foca o app (e abre a página certa) ou abre uma janela nova.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    (async () => {
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
    self.registration.showNotification(title, {
      body: payload.body || '',
      tag: payload.tag,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      lang: 'pt-BR',
      data: { url: payload.url || '/' },
    }),
  )
})
