import { AnimatePresence, motion } from 'framer-motion'
import { Bell, CheckCheck, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useNotificationInbox } from '../../lib/notificationInbox'
import { useConfirm } from '../ui/Feedback'

function timeLabel(timestamp: number) {
  const diffMin = Math.max(0, Math.round((Date.now() - timestamp) / 60_000))
  if (diffMin < 1) return 'Agora'
  if (diffMin < 60) return `Há ${diffMin} min`
  const hours = Math.floor(diffMin / 60)
  if (hours < 24) return `Há ${hours} h`
  return new Date(timestamp).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

export function NotificationCenter() {
  const navigate = useNavigate()
  const { confirm } = useConfirm()
  const { items, unread, markRead, markAllRead, clear } =
    useNotificationInbox()
  const [open, setOpen] = useState(false)
  const [onlyUnread, setOnlyUnread] = useState(false)

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const visible = onlyUnread ? items.filter((item) => !item.read) : items

  async function handleClear() {
    const ok = await confirm({
      title: 'Limpar notificações?',
      message: 'Todo o histórico desta central será removido deste aparelho.',
      confirmLabel: 'Limpar tudo',
      danger: true,
    })
    if (ok) await clear()
  }

  return (
    <>
      <button
        type="button"
        className="notification-center-trigger"
        aria-label={
          unread > 0
            ? `Notificações, ${unread} não ${unread === 1 ? 'lida' : 'lidas'}`
            : 'Notificações'
        }
        onClick={() => setOpen(true)}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="notification-center-trigger__badge">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <div className="app-confirm notification-center-overlay">
              <motion.button
                type="button"
                className="app-confirm__backdrop"
                aria-label="Fechar central de notificações"
                onClick={() => setOpen(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
              <motion.section
                className="surface notification-center"
                role="dialog"
                aria-modal="true"
                aria-labelledby="notification-center-title"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 18 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <header className="notification-center__head">
                  <div>
                    <p className="page-kicker">VIDA</p>
                    <h2 id="notification-center-title">Notificações</h2>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Fechar"
                    onClick={() => setOpen(false)}
                  >
                    <X size={18} />
                  </button>
                </header>

                <div className="notification-center__toolbar">
                  <div
                    className="notification-center__tabs"
                    role="tablist"
                    aria-label="Filtro das notificações"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={!onlyUnread}
                      className={!onlyUnread ? 'is-active' : ''}
                      onClick={() => setOnlyUnread(false)}
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={onlyUnread}
                      className={onlyUnread ? 'is-active' : ''}
                      onClick={() => setOnlyUnread(true)}
                    >
                      Não lidas {unread > 0 ? `(${unread})` : ''}
                    </button>
                  </div>
                  {unread > 0 && (
                    <button
                      type="button"
                      className="btn btn--ghost notification-center__mark"
                      onClick={() => void markAllRead()}
                    >
                      <CheckCheck size={15} />
                      Marcar lidas
                    </button>
                  )}
                </div>

                <div className="notification-center__list">
                  {visible.length === 0 ? (
                    <div className="notification-center__empty">
                      <Bell size={28} />
                      <strong>
                        {onlyUnread
                          ? 'Tudo em dia'
                          : 'Nenhuma notificação ainda'}
                      </strong>
                      <span>
                        Os seus lembretes aparecerão aqui, mesmo quando chegarem
                        com o app fechado.
                      </span>
                    </div>
                  ) : (
                    visible.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`notification-center__item${item.read ? '' : ' is-unread'}`}
                        onClick={() => {
                          void markRead(item.id)
                          setOpen(false)
                          navigate(item.url)
                        }}
                      >
                        <span
                          className="notification-center__item-dot"
                          aria-hidden
                        />
                        <span className="notification-center__item-copy">
                          <strong>{item.title}</strong>
                          <span>{item.body}</span>
                          <time dateTime={new Date(item.createdAt).toISOString()}>
                            {timeLabel(item.createdAt)}
                          </time>
                        </span>
                      </button>
                    ))
                  )}
                </div>

                {items.length > 0 && (
                  <footer className="notification-center__foot">
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => void handleClear()}
                    >
                      <Trash2 size={15} />
                      Limpar histórico
                    </button>
                  </footer>
                )}
              </motion.section>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
