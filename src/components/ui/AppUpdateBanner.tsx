import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Atualização da app sem apagar dados:
 * o SW só troca assets; localStorage/Firestore ficam intactos.
 * O utilizador escolhe quando recarregar.
 */
export function AppUpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
  })
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(needRefresh)
  }, [needRefresh])

  if (!visible) return null

  return (
    <div className="app-update-banner" role="status">
      <p>Nova versão pronta. Os teus dados ficam guardados.</p>
      <div className="app-update-banner__actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setNeedRefresh(false)
            setVisible(false)
          }}
        >
          Depois
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => updateServiceWorker(true)}
        >
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>
    </div>
  )
}
