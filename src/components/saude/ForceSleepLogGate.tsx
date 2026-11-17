import { Moon, Settings } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  emptySleepHabits,
  sleepHoursBetween,
} from '../../data/saudeDefaults'
import {
  readSaudeState,
  shouldForceWakeSleepLog,
  upsertSleepLocal,
} from '../../lib/saudePatch'
import type { SleepQuality } from '../../types/saude'
import { Button } from '../ui/Button'
import { useToast } from '../ui/Feedback'
import { QualityField } from './SaudeShared'
import { SleepTimelineSlider } from './SleepTimelineSlider'

export function ForceSleepLogGate() {
  const location = useLocation()
  const { toast } = useToast()
  const [tick, setTick] = useState(0)
  const [open, setOpen] = useState(false)

  const snapshot = useMemo(() => readSaudeState(), [tick, location.pathname])
  const onConfig = location.pathname.startsWith('/config')

  useEffect(() => {
    const refresh = () => setTick((n) => n + 1)
    refresh()
    const id = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    window.addEventListener('vida:module-external', refresh)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('vida:module-external', refresh)
    }
  }, [])

  useEffect(() => {
    if (onConfig) {
      setOpen(false)
      return
    }
    setOpen(shouldForceWakeSleepLog(snapshot))
  }, [snapshot, onConfig, tick])

  const bedDefault =
    snapshot.sleepGoalBedTime || snapshot.sleepReminderTime || '22:30'
  const wakeDefault =
    snapshot.wakeSleepGateTime || snapshot.sleepGoalWakeTime || '07:00'

  const [bedTime, setBedTime] = useState(bedDefault)
  const [wakeTime, setWakeTime] = useState(wakeDefault)
  const [hours, setHours] = useState(
    () => String(sleepHoursBetween(bedDefault, wakeDefault) ?? 7.5),
  )
  const [quality, setQuality] = useState<SleepQuality>(3)
  const [readiness, setReadiness] = useState<SleepQuality>(3)

  useEffect(() => {
    if (!open) return
    const bed = snapshot.sleepGoalBedTime || snapshot.sleepReminderTime || '22:30'
    const wake =
      snapshot.wakeSleepGateTime || snapshot.sleepGoalWakeTime || '07:00'
    setBedTime(bed)
    setWakeTime(wake)
    setHours(String(sleepHoursBetween(bed, wake) ?? 7.5))
    setQuality(3)
    setReadiness(3)
  }, [open, snapshot.sleepGoalBedTime, snapshot.sleepReminderTime, snapshot.sleepGoalWakeTime, snapshot.wakeSleepGateTime])

  if (!open || onConfig) return null

  function applyClock(bed: string, wake: string) {
    setBedTime(bed)
    setWakeTime(wake)
    const next = sleepHoursBetween(bed, wake)
    if (next != null) setHours(String(next))
  }

  function save() {
    const h = Number(hours)
    if (!h) {
      toast('Ajusta a linha do tempo do sono', 'warn')
      return
    }
    upsertSleepLocal({
      hours: h,
      quality,
      readiness,
      bedTime,
      wakeTime,
      latencyMin: 0,
      awakenings: 0,
      habits: emptySleepHabits(),
    })
    toast('Sono registado — bom dia', 'ok')
    setOpen(false)
    setTick((n) => n + 1)
  }

  return (
    <div className="sleep-gate" role="dialog" aria-modal="true" aria-labelledby="sleep-gate-title">
      <div className="sleep-gate__backdrop" aria-hidden />
      <div className="sleep-gate__card surface">
        <div className="sleep-gate__head">
          <span className="sleep-gate__badge" aria-hidden>
            <Moon size={18} />
          </span>
          <div>
            <p className="page-kicker">Bom dia</p>
            <h2 id="sleep-gate-title">Quanto dormiste?</h2>
            <p>
              Regista a noite para liberar a app. Podes desligar isto nas
              configurações.
            </p>
          </div>
        </div>

        <SleepTimelineSlider
          bedTime={bedTime}
          wakeTime={wakeTime}
          onChange={applyClock}
        />

        <QualityField
          label="Qualidade do descanso"
          value={quality}
          onChange={setQuality}
          hint="1 = péssimo · 5 = excelente"
        />
        <QualityField
          label="Disposição ao acordar"
          value={readiness}
          onChange={setReadiness}
          hint="Como te sentiste ao levantar"
        />

        <div className="sleep-gate__actions">
          <Button variant="primary" onClick={save}>
            Guardar e continuar
          </Button>
          <Link to="/config" className="sleep-gate__config">
            <Settings size={15} />
            Configurações
          </Link>
        </div>
      </div>
    </div>
  )
}
