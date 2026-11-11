import { Outlet } from 'react-router-dom'
import { Atmosphere } from './Atmosphere'
import { AppNav } from './AppNav'
import { OfflineBanner } from './OfflineBanner'
import { CloudSyncBadge } from '../ui/CloudSyncBadge'
import { AppUpdateBanner } from '../ui/AppUpdateBanner'
import { PullToRefresh } from '../ui/PullToRefresh'
import { ensureCloudUser } from '../../lib/cloudSync'
import { firebaseReady, initAnalytics } from '../../lib/firebase'
import { useEffect } from 'react'
import { useReminderRunner } from '../../hooks/useReminderRunner'
import { NotificationCenter } from '../notifications/NotificationCenter'

export function AppShell() {
  useReminderRunner()

  useEffect(() => {
    if (!firebaseReady) return
    void ensureCloudUser()
    void initAnalytics()
  }, [])

  return (
    <>
      <Atmosphere />
      <OfflineBanner />
      <AppUpdateBanner />
      <CloudSyncBadge />
      <NotificationCenter />
      <div className="app-shell">
        <AppNav variant="side" />
        <main className="app-main">
          <PullToRefresh>
            <Outlet />
          </PullToRefresh>
        </main>
        <AppNav variant="bottom" />
      </div>
    </>
  )
}
