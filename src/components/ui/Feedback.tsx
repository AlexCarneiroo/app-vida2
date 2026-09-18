import { AnimatePresence, motion } from 'framer-motion'
import { Check, Info, X } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type ToastTone = 'ok' | 'info' | 'warn'

type ToastItem = {
  id: string
  message: string
  tone: ToastTone
}

export type ConfirmOptions = {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ToastApi = {
  toast: (message: string, tone?: ToastTone) => void
}

type ConfirmApi = {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ToastContext = createContext<ToastApi | null>(null)
const ConfirmContext = createContext<ConfirmApi | null>(null)

let toastSeq = 0

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const toast = useCallback((message: string, tone: ToastTone = 'ok') => {
    const id = `toast_${++toastSeq}`
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2800)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current?.(false)
      resolverRef.current = resolve
      setDialog(options)
    })
  }, [])

  const closeDialog = useCallback((value: boolean) => {
    resolverRef.current?.(value)
    resolverRef.current = null
    setDialog(null)
  }, [])

  const toastApi = useMemo(() => ({ toast }), [toast])
  const confirmApi = useMemo(() => ({ confirm }), [confirm])

  return (
    <ToastContext.Provider value={toastApi}>
      <ConfirmContext.Provider value={confirmApi}>
        {children}

        <div className="app-toasts" aria-live="polite">
          <AnimatePresence initial={false}>
            {toasts.map((item) => (
              <motion.div
                key={item.id}
                className={`app-toast app-toast--${item.tone}`}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                role="status"
              >
                <span className="app-toast__icon">
                  {item.tone === 'warn' ? <Info size={15} /> : <Check size={15} />}
                </span>
                <p>{item.message}</p>
                <button
                  type="button"
                  className="app-toast__close"
                  onClick={() => dismissToast(item.id)}
                  aria-label="Fechar"
                >
                  <X size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {dialog && (
            <motion.div
              className="app-confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <button
                type="button"
                className="app-confirm__backdrop"
                aria-label="Cancelar"
                onClick={() => closeDialog(false)}
              />
              <motion.div
                className="surface app-confirm__card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="app-confirm-title"
                initial={{ opacity: 0, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.96 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <h2 id="app-confirm-title">{dialog.title}</h2>
                {dialog.message && <p>{dialog.message}</p>}
                <div className="app-confirm__actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => closeDialog(false)}
                  >
                    {dialog.cancelLabel ?? 'Cancelar'}
                  </button>
                  <button
                    type="button"
                    className={`btn ${dialog.danger !== false ? 'btn--danger' : 'btn--primary'}`}
                    onClick={() => closeDialog(true)}
                    autoFocus
                  >
                    {dialog.confirmLabel ?? 'Excluir'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast precisa de FeedbackProvider')
  return ctx
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm precisa de FeedbackProvider')
  return ctx
}
