import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  buildHealthInsights,
  buildWeeklyInsights,
  calcImc,
  checkInForDay,
  compressImageFile,
  createCheckIn,
  createExam,
  createMedication,
  createMetric,
  createProNote,
  createSleep,
  emptySaudeState,
  examSeries,
  examsDueSoon,
  imcLabel,
  latestMetric,
  moodHeatmapLog,
  runQuickConsult,
  sleepDebtHours,
  sleepForDay,
  vitalityScore,
  weekSleepOkDays,
  weekWaterOkDays,
  weightProjectionWeeks,
  type VitalSignals,
} from '../data/saudeDefaults'
import { dateKey, shiftDateKey, uid } from '../lib/date'
import { loadSaudePersisted } from '../lib/persist'
import type {
  BodySex,
  LabExam,
  SaudeState,
  SleepQuality,
  WeeklyHealthGoals,
} from '../types/saude'
import { useCloudSyncedState } from './useCloudSyncedState'
import { useHabitos } from './useHabitos'
import { useNutricao } from './useNutricao'
import { useToast } from '../components/ui/Feedback'
import { useTreino } from './useTreino'

const STORAGE_KEY = 'vida.saude.v1'

function loadDoc() {
  return loadSaudePersisted(STORAGE_KEY, emptySaudeState())
}

const isEmpty = (d: SaudeState) =>
  d.metrics.length === 0 &&
  d.sleep.length === 0 &&
  d.exams.length === 0 &&
  d.checkIns.length === 0 &&
  d.medications.length === 0 &&
  d.photos.length === 0 &&
  d.heightCm <= 0 &&
  !d.lastConsult

export function useSaude() {
  const { state, update } = useCloudSyncedState<SaudeState>({
    collection: 'saude',
    storageKey: STORAGE_KEY,
    load: loadDoc,
    isEmpty,
  })
  const { toast } = useToast()
  const remindedRef = useRef<string | null>(null)

  const { water, todayMacros, state: nutriState } = useNutricao()
  const { isTodayDone } = useTreino()
  const { dueToday } = useHabitos()

  const today = dateKey()
  const yesterday = shiftDateKey(today, -1)

  const healthHabits = useMemo(
    () => dueToday.filter((h) => h.category === 'saude'),
    [dueToday],
  )
  const healthHabitsDone = healthHabits.filter((h) => h.doneToday).length

  const lastWeight = useMemo(
    () => latestMetric(state.metrics),
    [state.metrics],
  )
  const imc = useMemo(
    () =>
      lastWeight ? calcImc(lastWeight.weightKg, state.heightCm) : null,
    [lastWeight, state.heightCm],
  )
  const tonightSleep = sleepForDay(state.sleep, today)
  const lastNightSleep = sleepForDay(state.sleep, yesterday)
  const sleepRef = tonightSleep ?? lastNightSleep
  const todayCheckIn = checkInForDay(state.checkIns, today)
  const sleepDebt = useMemo(
    () => sleepDebtHours(state.sleep, today),
    [state.sleep, today],
  )
  const waterWeekDays = useMemo(
    () =>
      weekWaterOkDays(nutriState.waterByDay ?? {}, nutriState.waterGoal, today),
    [nutriState.waterByDay, nutriState.waterGoal, today],
  )
  const sleepWeekDays = useMemo(
    () => weekSleepOkDays(state.sleep, today),
    [state.sleep, today],
  )

  const signals: VitalSignals = useMemo(() => {
    const waterGoalMl = nutriState.waterGoal
    const sleepHours = sleepRef?.hours ?? null
    return {
      waterMl: water,
      waterGoalMl,
      waterOk: waterGoalMl > 0 && water >= waterGoalMl * 0.9,
      kcal: todayMacros.kcal,
      protein: todayMacros.protein,
      trainedToday: isTodayDone,
      sleepHours,
      sleepOk: sleepHours !== null && sleepHours >= 7 && sleepHours <= 9,
      imc,
      imcOk: imc !== null && imc >= 18.5 && imc < 25,
      checkInDone: Boolean(todayCheckIn),
      healthHabitsDone,
      healthHabitsTotal: healthHabits.length,
      waterWeekDays,
      sleepWeekDays,
      weeklyGoals: state.weeklyGoals,
    }
  }, [
    water,
    nutriState.waterGoal,
    todayMacros,
    isTodayDone,
    sleepRef,
    imc,
    todayCheckIn,
    healthHabitsDone,
    healthHabits.length,
    waterWeekDays,
    sleepWeekDays,
    state.weeklyGoals,
  ])

  const score = vitalityScore(signals)
  const insights = useMemo(
    () => buildHealthInsights(signals, sleepDebt),
    [signals, sleepDebt],
  )
  const weeklyInsights = useMemo(
    () => buildWeeklyInsights(signals, sleepDebt),
    [signals, sleepDebt],
  )
  const dueExams = useMemo(
    () => examsDueSoon(state.exams, today, 45),
    [state.exams, today],
  )

  const weightTrend = useMemo(
    () =>
      [...state.metrics]
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
        .slice(-12)
        .map((m) => m.weightKg),
    [state.metrics],
  )

  const projectionWeeks = useMemo(() => {
    if (!lastWeight || state.weightGoalKg <= 0) return null
    return weightProjectionWeeks(
      lastWeight.weightKg,
      state.weightGoalKg,
      weightTrend,
    )
  }, [lastWeight, state.weightGoalKg, weightTrend])

  const sleepWeek = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const key = shiftDateKey(today, i - 6)
        const entry = sleepForDay(state.sleep, key)
        return {
          dateKey: key,
          hours: entry?.hours ?? 0,
          quality: entry?.quality,
        }
      }),
    [state.sleep, today],
  )

  const moodLog = useMemo(
    () => moodHeatmapLog(state.checkIns),
    [state.checkIns],
  )

  const poorSleepForTraining =
    (lastNightSleep?.hours ?? 99) < 6.5 && lastNightSleep !== null

  useEffect(() => {
    if (!state.sleepReminderEnabled || !state.sleepReminderTime) return
    const [hh, mm] = state.sleepReminderTime.split(':').map(Number)
    const tick = () => {
      const now = new Date()
      const mins = now.getHours() * 60 + now.getMinutes()
      const target = (hh || 22) * 60 + (mm || 0)
      const stamp = `${today}-${state.sleepReminderTime}`
      if (Math.abs(mins - target) <= 12 && remindedRef.current !== stamp) {
        if (!tonightSleep) {
          remindedRef.current = stamp
          toast('Lembrete de sono — hora de desacelerar', 'info')
        }
      }
    }
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [
    state.sleepReminderEnabled,
    state.sleepReminderTime,
    today,
    tonightSleep,
    toast,
  ])

  const setProfile = useCallback(
    (patch: {
      heightCm?: number
      sex?: BodySex | null
      weightGoalKg?: number
      sleepReminderEnabled?: boolean
      sleepReminderTime?: string
      weeklyGoals?: Partial<WeeklyHealthGoals>
    }) => {
      update((prev) => ({
        ...prev,
        heightCm:
          patch.heightCm !== undefined
            ? Math.max(0, Math.min(250, Math.round(patch.heightCm)))
            : prev.heightCm,
        sex: patch.sex !== undefined ? patch.sex : prev.sex,
        weightGoalKg:
          patch.weightGoalKg !== undefined
            ? Math.max(0, Math.min(400, patch.weightGoalKg))
            : prev.weightGoalKg,
        sleepReminderEnabled:
          patch.sleepReminderEnabled !== undefined
            ? patch.sleepReminderEnabled
            : prev.sleepReminderEnabled,
        sleepReminderTime:
          patch.sleepReminderTime !== undefined
            ? patch.sleepReminderTime
            : prev.sleepReminderTime,
        weeklyGoals: patch.weeklyGoals
          ? {
              waterDaysTarget: Math.max(
                1,
                Math.min(
                  7,
                  patch.weeklyGoals.waterDaysTarget ??
                    prev.weeklyGoals.waterDaysTarget,
                ),
              ),
              sleepDaysTarget: Math.max(
                1,
                Math.min(
                  7,
                  patch.weeklyGoals.sleepDaysTarget ??
                    prev.weeklyGoals.sleepDaysTarget,
                ),
              ),
            }
          : prev.weeklyGoals,
      }))
    },
    [update],
  )

  const addWeight = useCallback(
    (input: {
      weightKg: number
      waistCm?: number
      armCm?: number
      bodyFatPct?: number
      leanMassKg?: number
      note?: string
      dateKey?: string
    }) => {
      if (input.weightKg <= 0) return
      const metric = createMetric(input)
      update((prev) => ({
        ...prev,
        metrics: [metric, ...prev.metrics].slice(0, 200),
      }))
    },
    [update],
  )

  const removeMetric = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        metrics: prev.metrics.filter((m) => m.id !== id),
      }))
    },
    [update],
  )

  const upsertSleep = useCallback(
    (input: {
      hours: number
      quality: SleepQuality
      bedTime?: string | null
      wakeTime?: string | null
      note?: string
      dateKey?: string
    }) => {
      const day = input.dateKey || today
      const entry = createSleep({ ...input, dateKey: day })
      update((prev) => {
        const rest = prev.sleep.filter((s) => s.dateKey !== day)
        return { ...prev, sleep: [entry, ...rest].slice(0, 120) }
      })
    },
    [today, update],
  )

  const addExam = useCallback(
    (input: Parameters<typeof createExam>[0]) => {
      const exam = createExam(input)
      update((prev) => ({
        ...prev,
        exams: [exam, ...prev.exams].slice(0, 150),
      }))
      return exam.id
    },
    [update],
  )

  const removeExam = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        exams: prev.exams.filter((e) => e.id !== id),
      }))
    },
    [update],
  )

  const upsertCheckIn = useCallback(
    (input: {
      energy: SleepQuality
      mood: SleepQuality
      symptoms?: string
    }) => {
      const row = createCheckIn({ ...input, dateKey: today })
      update((prev) => {
        const rest = prev.checkIns.filter((c) => c.dateKey !== today)
        return { ...prev, checkIns: [row, ...rest].slice(0, 120) }
      })
    },
    [today, update],
  )

  const addMedication = useCallback(
    (input: { name: string; dose: string; time: string }) => {
      const med = createMedication(input)
      update((prev) => ({
        ...prev,
        medications: [...prev.medications, med].slice(0, 40),
      }))
    },
    [update],
  )

  const toggleMedTaken = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        medications: prev.medications.map((m) => {
          if (m.id !== id) return m
          const taken = m.lastTakenDateKey === today
          return {
            ...m,
            lastTakenDateKey: taken ? null : today,
          }
        }),
      }))
    },
    [today, update],
  )

  const removeMedication = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        medications: prev.medications.filter((m) => m.id !== id),
      }))
    },
    [update],
  )

  const addPhoto = useCallback(
    async (file: File, note?: string) => {
      const { dataUrl } = await compressImageFile(file)
      const photo = {
        id: uid('photo'),
        dateKey: today,
        dataUrl,
        note: note?.trim() || undefined,
        createdAt: new Date().toISOString(),
      }
      update((prev) => ({
        ...prev,
        photos: [photo, ...prev.photos].slice(0, 8),
      }))
    },
    [today, update],
  )

  const removePhoto = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        photos: prev.photos.filter((p) => p.id !== id),
      }))
    },
    [update],
  )

  const saveConsult = useCallback(
    (q1: string, q2: string, q3: string) => {
      const consult = runQuickConsult(q1, q2, q3)
      update((prev) => ({
        ...prev,
        lastConsult: consult,
        proNotes: [
          createProNote('Dra. Pulse', consult.plan.join(' ')),
          ...prev.proNotes,
        ].slice(0, 40),
      }))
      return consult
    },
    [update],
  )

  const addProNote = useCallback(
    (author: string, body: string) => {
      if (!body.trim()) return
      update((prev) => ({
        ...prev,
        proNotes: [createProNote(author, body), ...prev.proNotes].slice(0, 40),
      }))
    },
    [update],
  )

  const seriesFor = useCallback(
    (name: string) => examSeries(state.exams, name),
    [state.exams],
  )

  return {
    state,
    today,
    lastWeight,
    imc,
    imcLabel: imc !== null ? imcLabel(imc) : null,
    tonightSleep,
    lastNightSleep,
    todayCheckIn,
    signals,
    score,
    insights,
    weeklyInsights,
    sleepDebt,
    dueExams,
    weightTrend,
    projectionWeeks,
    sleepWeek,
    moodLog,
    exams: state.exams,
    poorSleepForTraining,
    healthHabits,
    setProfile,
    addWeight,
    removeMetric,
    upsertSleep,
    addExam,
    removeExam,
    upsertCheckIn,
    addMedication,
    toggleMedTaken,
    removeMedication,
    addPhoto,
    removePhoto,
    saveConsult,
    addProNote,
    seriesFor,
  }
}

export type { LabExam }
