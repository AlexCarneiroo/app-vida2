import { useCallback, useRef, useState } from 'react'

const MIN_MS = 280

/**
 * Evita duplo clique e mostra loading o tempo suficiente para o utilizador ver.
 */
export function useBusyAction() {
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)

  const run = useCallback(async (action: () => void | Promise<void>) => {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    const started = Date.now()
    try {
      await action()
    } finally {
      const wait = Math.max(0, MIN_MS - (Date.now() - started))
      if (wait > 0) {
        await new Promise((r) => setTimeout(r, wait))
      }
      locked.current = false
      setBusy(false)
    }
  }, [])

  return { busy, run }
}
