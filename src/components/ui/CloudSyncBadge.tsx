import { CloudOff } from 'lucide-react'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { firebaseReady } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'

/** Só aparece offline — quando está na nuvem, não ocupa ecrã. */
export function CloudSyncBadge() {
  const { ready } = useAuth()
  const online = useOnlineStatus()

  if (!firebaseReady || !ready || online) return null

  return (
    <div
      className="cloud-sync-badge cloud-sync-badge--offline"
      title="Offline — os dados ficam neste dispositivo"
      aria-live="polite"
    >
      <CloudOff size={12} />
      <span>Offline</span>
    </div>
  )
}
