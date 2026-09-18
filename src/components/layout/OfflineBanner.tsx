import { WifiOff } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

export function OfflineBanner() {
  const online = useOnlineStatus()

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          className="offline-banner"
          role="status"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <WifiOff size={15} />
          <span>Modo offline — os dados ficam guardados neste dispositivo.</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
