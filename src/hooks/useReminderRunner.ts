import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { upsertInboxNotice } from '../lib/notificationInbox'
import {
  currentPermission,
  isPushActive,
  markFired,
  showNotice,
  usePushActive,
  useNotifSettings,
} from '../lib/notifications'
import {
  disablePush,
  ensurePush,
  pushConfigured,
  syncPushSettings,
} from '../lib/pushClient'
import {
  collectDueReminders,
  collectLiveStatusNotices,
  type DataName,
  type DueReminder,
  type ReadState,
  type ReminderStates,
} from '../lib/reminderEngine'

const TICK_MS = 20_000

const STORAGE_KEYS: Record<DataName, string> = {
  treino: 'vida.treino.v1',
  habitos: 'vida.habitos.v1',
  nutricao: 'vida.nutricao.v1',
  financas: 'vida.financas.v1',
  rotina: 'vida.rotina.v1',
  compras: 'vida.compras.v1',
}

/** Lê o estado guardado neste aparelho sem migrar nem gravar nada. */
const readLocal: ReadState = <K extends DataName>(name: K) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS[name])
    if (!raw) return null
    let node: unknown = JSON.parse(raw)
    for (let i = 0; i < 3; i++) {
      if (
        node &&
        typeof node === 'object' &&
        'schemaVersion' in node &&
        'data' in node
      ) {
        node = (node as { data: unknown }).data
      }
    }
    return node && typeof node === 'object'
      ? (node as Partial<ReminderStates[K]>)
      : null
  } catch {
    return null
  }
}

async function refreshInbox(notices: DueReminder[]) {
  for (const notice of notices) {
    await upsertInboxNotice(notice)
  }
}

/**
 * Lembretes + push. Montar uma única vez, dentro do Router.
 *
 * - Com push do servidor ativo, é o servidor que avisa (funciona com o app
 *   fechado) e este aparelho não duplica o alerta do sistema.
 * - Em qualquer modo, a central de notificações é atualizada com os
 *   resultados atuais (água, hábitos, treino…).
 * - Sem push: alerta local a cada 20 s enquanto o app está aberto.
 */
export function useReminderRunner() {
  const settings = useNotifSettings()
  const pushActive = usePushActive()
  const navigate = useNavigate()

  useEffect(() => {
    if (!pushConfigured()) return
    if (settings.enabled) void ensurePush()
    else if (isPushActive()) void disablePush()
  }, [settings.enabled])

  const settingsKey = JSON.stringify(settings)
  useEffect(() => {
    if (!pushActive) return
    const timer = window.setTimeout(() => void syncPushSettings(), 800)
    return () => window.clearTimeout(timer)
  }, [settingsKey, pushActive])

  useEffect(() => {
    if (!settings.enabled) return

    const tick = () => {
      const ctx = {
        now: new Date(),
        settings,
        read: readLocal,
      }

      // Sempre atualiza a central com o progresso real do dia.
      const live = collectLiveStatusNotices(ctx)
      void refreshInbox(live)

      const due = collectDueReminders(ctx)
      // Atualiza o texto dos avisos devidos (mesmo já disparados).
      void refreshInbox(due)

      // Alerta do sistema só no modo local (sem push do servidor).
      if (pushActive) return
      if (currentPermission() !== 'granted') return
      for (const reminder of due) {
        if (markFired(reminder.id)) void showNotice(reminder)
      }
    }

    tick()
    const timer = window.setInterval(tick, TICK_MS)
    let debounce: number | undefined
    const tickSoon = () => {
      window.clearTimeout(debounce)
      debounce = window.setTimeout(tick, 120)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return
      if (Object.values(STORAGE_KEYS).includes(e.key)) tickSoon()
    }
    const onModule = (event: Event) => {
      const key = (event as CustomEvent<{ storageKey?: string }>).detail
        ?.storageKey
      if (!key || !Object.values(STORAGE_KEYS).includes(key)) return
      tickSoon()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', tick)
    window.addEventListener('storage', onStorage)
    window.addEventListener('vida:module-external', onModule)
    window.addEventListener('vida:reminders-refresh', tickSoon)
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(debounce)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', tick)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('vida:module-external', onModule)
      window.removeEventListener('vida:reminders-refresh', tickSoon)
    }
  }, [settings, pushActive])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; url?: string } | null
      if (data?.type === 'vida:navigate' && typeof data.url === 'string') {
        navigate(data.url)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () =>
      navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate])
}
