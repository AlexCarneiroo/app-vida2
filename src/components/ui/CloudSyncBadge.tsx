import { Cloud, CloudOff, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  getSyncStatus,
  subscribeSyncStatus,
  type SyncStatus,
} from '../../lib/cloudSync'
import { firebaseReady, initAnalytics } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'

const LABELS: Record<SyncStatus, string> = {
  idle: 'Nuvem',
  syncing: 'A sincronizar…',
  saved: 'Na nuvem',
  offline: 'Offline',
  error: 'Sem nuvem',
}

export function CloudSyncBadge() {
  const { isRegistered, ready } = useAuth()
  const [status, setStatus] = useState<SyncStatus>(() => getSyncStatus())

  useEffect(() => {
    if (!firebaseReady) return
    void initAnalytics()
    const unsub = subscribeSyncStatus(setStatus)
    return () => {
      unsub()
    }
  }, [])

  if (!firebaseReady || !ready) return null

  // Sem conta: não assustar com "erro" — dados ficam só no dispositivo
  if (!isRegistered) {
    if (status === 'syncing') {
      return (
        <div className="cloud-sync-badge cloud-sync-badge--syncing" aria-live="polite">
          <Loader2 size={12} className="cloud-sync-badge__spin" />
          <span>A sincronizar…</span>
        </div>
      )
    }
    return null
  }

  if (status === 'idle') return null

  return (
    <div
      className={`cloud-sync-badge cloud-sync-badge--${status}`}
      title={LABELS[status]}
      aria-live="polite"
    >
      {status === 'syncing' ? (
        <Loader2 size={12} className="cloud-sync-badge__spin" />
      ) : status === 'offline' || status === 'error' ? (
        <CloudOff size={12} />
      ) : (
        <Cloud size={12} />
      )}
      <span>{LABELS[status]}</span>
    </div>
  )
}
