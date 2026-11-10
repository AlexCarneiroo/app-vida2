import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
  type DataName,
  type ReadState,
  type ReminderStates,
} from '../lib/reminderEngine'

const TICK_MS = 30_000

const STORAGE_KEYS: Record<DataName, string> = {
  treino: 'vida.treino.v1',
  habitos: 'vida.habitos.v1',
  nutricao: 'vida.nutricao.v1',
  financas: 'vida.financas.v1',
  rotina: 'vida.rotina.v1',
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

/**
 * Lembretes + push. Montar uma única vez, dentro do Router.
 *
 * - Com push do servidor ativo, é o servidor que avisa (funciona com o app
 *   fechado) e este aparelho não duplica.
 * - Sem push (sem servidor, bloqueado ou iPhone sem instalar), cai no modo
 *   local: verifica a cada 30 s enquanto o app está aberto.
 */
export function useReminderRunner() {
  const settings = useNotifSettings()
  const pushActive = usePushActive()
  const navigate = useNavigate()

  // Liga/desliga o push do servidor conforme o interruptor geral.
  useEffect(() => {
    if (!pushConfigured()) return
    if (settings.enabled) void ensurePush()
    else if (isPushActive()) void disablePush()
  }, [settings.enabled])

  // Mantém as configurações do servidor iguais às deste aparelho.
  const settingsKey = JSON.stringify(settings)
  useEffect(() => {
    if (!pushActive) return
    const timer = window.setTimeout(() => void syncPushSettings(), 800)
    return () => window.clearTimeout(timer)
  }, [settingsKey, pushActive])

  // Modo local (fallback): só quando o servidor não está a cuidar dos avisos.
  useEffect(() => {
    if (!settings.enabled || pushActive) return

    const tick = () => {
      if (currentPermission() !== 'granted') return
      const due = collectDueReminders({
        now: new Date(),
        settings,
        read: readLocal,
      })
      for (const reminder of due) {
        if (markFired(reminder.id)) void showNotice(reminder)
      }
    }

    tick()
    const timer = window.setInterval(tick, TICK_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', tick)
    }
  }, [settings, pushActive])

  // Tocar numa notificação com o app aberto: o SW pede para abrir a rota.
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
