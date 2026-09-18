import { Outlet } from 'react-router-dom'
import { Atmosphere } from './Atmosphere'
import { AppNav } from './AppNav'
import { OfflineBanner } from './OfflineBanner'
import { CloudSyncBadge } from '../ui/CloudSyncBadge'
import { AppUpdateBanner } from '../ui/AppUpdateBanner'
import { ensureCloudUser } from '../../lib/cloudSync'
import { firebaseReady, initAnalytics } from '../../lib/firebase'
import { useEffect } from 'react'

export function AppShell() {
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
      <div className="app-shell">
        <AppNav variant="side" />
        <main className="app-main">
          <Outlet />
        </main>
        <AppNav variant="bottom" />
      </div>
    </>
  )
}
