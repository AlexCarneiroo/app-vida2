import { useEffect, useState } from 'react'
import { dateKey } from '../lib/date'

/** DateKey civil que atualiza à meia-noite, ao focar a app e a cada minuto. */
export function useCalendarDay() {
  const [today, setToday] = useState(() => dateKey())

  useEffect(() => {
    const sync = () => {
      const next = dateKey()
      setToday((prev) => (prev === next ? prev : next))
    }

    const msUntilTomorrow = () => {
      const now = new Date()
      const next = new Date(now)
      next.setHours(24, 0, 1, 0)
      return Math.max(250, next.getTime() - now.getTime())
    }

    let midnight = window.setTimeout(function onMidnight() {
      sync()
      midnight = window.setTimeout(onMidnight, msUntilTomorrow())
    }, msUntilTomorrow())

    const pulse = window.setInterval(sync, 30_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }

    window.addEventListener('focus', sync)
    window.addEventListener('pageshow', sync)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearTimeout(midnight)
      window.clearInterval(pulse)
      window.removeEventListener('focus', sync)
      window.removeEventListener('pageshow', sync)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return today
}
