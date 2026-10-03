import { dateKey, shiftDateKey, uid } from '../lib/date'
import type {
  BodyMetric,
  BodySex,
  HealthCheckIn,
  LabExam,
  Medication,
  ProNote,
  QuickConsult,
  SaudeState,
  SleepEntry,
  SleepQuality,
  WeeklyHealthGoals,
} from '../types/saude'

export const emptySaudeState = (): SaudeState => ({
  heightCm: 0,
  sex: null,
  weightGoalKg: 0,
  sleepReminderEnabled: false,
  sleepReminderTime: '22:30',
  weeklyGoals: { waterDaysTarget: 5, sleepDaysTarget: 5 },
  metrics: [],
  sleep: [],
  exams: [],
  checkIns: [],
  medications: [],
  photos: [],
  lastConsult: null,
  proNotes: [],
})

export function calcImc(weightKg: number, heightCm: number): number | null {
  if (weightKg <= 0 || heightCm <= 0) return null
  const m = heightCm / 100
  return Math.round((weightKg / (m * m)) * 10) / 10
}

export function imcLabel(imc: number): string {
  if (imc < 18.5) return 'Abaixo do peso'
  if (imc < 25) return 'Peso adequado'
  if (imc < 30) return 'Sobrepeso'
  if (imc < 35) return 'Obesidade I'
  if (imc < 40) return 'Obesidade II'
  return 'Obesidade III'
}

/** Projeção linear simples: semanas até à meta. */
export function weightProjectionWeeks(
  currentKg: number,
  goalKg: number,
  recent: number[],
): number | null {
  if (goalKg <= 0 || recent.length < 2) return null
  const deltaTotal = recent[recent.length - 1] - recent[0]
  // approx points as days if entries close; use per-entry slope
  const perStep = deltaTotal / (recent.length - 1)
  if (Math.abs(perStep) < 0.01) return null
  const need = goalKg - currentKg
  if (need === 0) return 0
  if (Math.sign(need) !== Math.sign(perStep)) return null
  const steps = need / perStep
  return Math.max(1, Math.ceil(steps / 7))
}

export function createMetric(input: {
  weightKg: number
  dateKey?: string
  waistCm?: number
  armCm?: number
  bodyFatPct?: number
  leanMassKg?: number
  note?: string
}): BodyMetric {
  return {
    id: uid('w'),
    dateKey: input.dateKey || dateKey(),
    weightKg: Math.round(input.weightKg * 10) / 10,
    waistCm: input.waistCm && input.waistCm > 0 ? input.waistCm : undefined,
    armCm: input.armCm && input.armCm > 0 ? input.armCm : undefined,
    bodyFatPct:
      input.bodyFatPct && input.bodyFatPct > 0 ? input.bodyFatPct : undefined,
    leanMassKg:
      input.leanMassKg && input.leanMassKg > 0 ? input.leanMassKg : undefined,
    note: input.note?.trim() || undefined,
    createdAt: new Date().toISOString(),
  }
}

export function createSleep(input: {
  hours: number
  quality: SleepQuality
  dateKey?: string
  bedTime?: string | null
  wakeTime?: string | null
  note?: string
}): SleepEntry {
  return {
    id: uid('sleep'),
    dateKey: input.dateKey || dateKey(),
    hours: Math.max(0, Math.min(24, Math.round(input.hours * 10) / 10)),
    quality: input.quality,
    bedTime: input.bedTime || null,
    wakeTime: input.wakeTime || null,
    note: input.note?.trim() || undefined,
  }
}

export function createExam(input: {
  name: string
  value: string
  dateKey?: string
  unit?: string
  refRange?: string
  note?: string
  nextDueDateKey?: string | null
  attachmentName?: string
  attachmentDataUrl?: string
}): LabExam {
  return {
    id: uid('exam'),
    dateKey: input.dateKey || dateKey(),
    name: input.name.trim() || 'Exame',
    value: input.value.trim() || '—',
    unit: input.unit?.trim() || undefined,
    refRange: input.refRange?.trim() || undefined,
    note: input.note?.trim() || undefined,
    nextDueDateKey: input.nextDueDateKey || null,
    attachmentName: input.attachmentName,
    attachmentDataUrl: input.attachmentDataUrl,
    createdAt: new Date().toISOString(),
  }
}

export function createCheckIn(input: {
  energy: SleepQuality
  mood: SleepQuality
  symptoms?: string
  dateKey?: string
}): HealthCheckIn {
  return {
    id: uid('check'),
    dateKey: input.dateKey || dateKey(),
    energy: input.energy,
    mood: input.mood,
    symptoms: input.symptoms?.trim() || undefined,
  }
}

export function createMedication(input: {
  name: string
  dose: string
  time: string
}): Medication {
  return {
    id: uid('med'),
    name: input.name.trim() || 'Medicamento',
    dose: input.dose.trim() || '',
    time: input.time || '08:00',
    enabled: true,
    lastTakenDateKey: null,
  }
}

export function createProNote(author: string, body: string): ProNote {
  return {
    id: uid('pro'),
    author: author.trim() || 'Dra. Pulse',
    body: body.trim(),
    createdAt: new Date().toISOString(),
  }
}

export const EXAM_IDEAS = [
  { name: 'Glicemia jejum', unit: 'mg/dL', refRange: '70–99' },
  { name: 'Hemoglobina', unit: 'g/dL', refRange: '12–17' },
  { name: 'Colesterol total', unit: 'mg/dL', refRange: '<200' },
  { name: 'Vitamina D', unit: 'ng/mL', refRange: '30–100' },
  { name: 'TSH', unit: 'mUI/L', refRange: '0.4–4.0' },
  { name: 'Pressão arterial', unit: 'mmHg', refRange: '<120/80' },
] as const

export const VITAL_QUICK = [
  { name: 'Pressão arterial', unit: 'mmHg', refRange: '<120/80' },
  { name: 'Glicemia', unit: 'mg/dL', refRange: '70–99' },
] as const

export function latestMetric(metrics: BodyMetric[]): BodyMetric | null {
  if (metrics.length === 0) return null
  return [...metrics].sort(
    (a, b) =>
      b.dateKey.localeCompare(a.dateKey) ||
      b.createdAt.localeCompare(a.createdAt),
  )[0]
}

export function sleepForDay(
  sleep: SleepEntry[],
  day: string,
): SleepEntry | null {
  return sleep.find((s) => s.dateKey === day) ?? null
}

export function checkInForDay(
  list: HealthCheckIn[],
  day: string,
): HealthCheckIn | null {
  return list.find((c) => c.dateKey === day) ?? null
}

/** Débito de sono vs 8h/noite nos últimos 7 dias. */
export function sleepDebtHours(sleep: SleepEntry[], today: string): number {
  let debt = 0
  for (let i = 0; i < 7; i++) {
    const key = shiftDateKey(today, -i)
    const entry = sleepForDay(sleep, key)
    const h = entry?.hours ?? 0
    if (h > 0 && h < 8) debt += 8 - h
  }
  return Math.round(debt * 10) / 10
}

export function weekWaterOkDays(
  waterByDay: Record<string, number>,
  goalMl: number,
  today: string,
): number {
  if (goalMl <= 0) return 0
  let n = 0
  for (let i = 0; i < 7; i++) {
    const key = shiftDateKey(today, -i)
    if ((waterByDay[key] ?? 0) >= goalMl * 0.9) n++
  }
  return n
}

export function weekSleepOkDays(sleep: SleepEntry[], today: string): number {
  let n = 0
  for (let i = 0; i < 7; i++) {
    const key = shiftDateKey(today, -i)
    const h = sleepForDay(sleep, key)?.hours
    if (h !== undefined && h >= 7 && h <= 9) n++
  }
  return n
}

export function examsDueSoon(
  exams: LabExam[],
  today: string,
  withinDays = 30,
): LabExam[] {
  const end = shiftDateKey(today, withinDays)
  return exams
    .filter(
      (e) =>
        e.nextDueDateKey &&
        e.nextDueDateKey >= today &&
        e.nextDueDateKey <= end,
    )
    .sort((a, b) =>
      (a.nextDueDateKey || '').localeCompare(b.nextDueDateKey || ''),
    )
}

export function examSeries(
  exams: LabExam[],
  name: string,
): Array<{ dateKey: string; value: number }> {
  const q = name.trim().toLowerCase()
  return exams
    .filter((e) => e.name.toLowerCase().includes(q))
    .map((e) => {
      const num = Number(String(e.value).replace(',', '.').replace(/[^\d.-]/g, ''))
      return { dateKey: e.dateKey, value: num }
    })
    .filter((e) => Number.isFinite(e.value))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
}

export function moodHeatmapLog(
  checkIns: HealthCheckIn[],
): Record<string, number> {
  const log: Record<string, number> = {}
  for (const c of checkIns) {
    log[c.dateKey] = c.mood
  }
  return log
}

export type VitalSignals = {
  waterMl: number
  waterGoalMl: number
  waterOk: boolean
  kcal: number
  protein: number
  trainedToday: boolean
  sleepHours: number | null
  sleepOk: boolean
  imc: number | null
  imcOk: boolean
  checkInDone: boolean
  healthHabitsDone: number
  healthHabitsTotal: number
  waterWeekDays: number
  sleepWeekDays: number
  weeklyGoals: WeeklyHealthGoals
}

export function vitalityScore(v: VitalSignals): number {
  let pts = 0
  let max = 0

  max += 20
  if (v.waterGoalMl > 0) {
    pts += Math.min(20, (v.waterMl / v.waterGoalMl) * 20)
  }

  max += 15
  if (v.sleepHours !== null) {
    if (v.sleepHours >= 7 && v.sleepHours <= 9) pts += 15
    else if (v.sleepHours >= 6) pts += 9
    else pts += 4
  }

  max += 15
  if (v.trainedToday) pts += 15

  max += 15
  if (v.kcal > 0) pts += Math.min(15, (v.kcal / 1600) * 15)

  max += 10
  if (v.imc !== null) pts += v.imcOk ? 10 : 4

  max += 5
  if (v.checkInDone) pts += 5

  max += 10
  if (v.healthHabitsTotal > 0) {
    pts += (v.healthHabitsDone / v.healthHabitsTotal) * 10
  }

  max += 10
  const wTarget = Math.max(1, v.weeklyGoals.waterDaysTarget)
  const sTarget = Math.max(1, v.weeklyGoals.sleepDaysTarget)
  pts += Math.min(5, (v.waterWeekDays / wTarget) * 5)
  pts += Math.min(5, (v.sleepWeekDays / sTarget) * 5)

  return Math.round((pts / Math.max(1, max)) * 100)
}

export type HealthInsight = {
  id: string
  tone: 'ok' | 'warn' | 'info'
  title: string
  body: string
}

export function buildHealthInsights(
  v: VitalSignals,
  sleepDebt: number,
): HealthInsight[] {
  const list: HealthInsight[] = []

  if (v.waterGoalMl > 0) {
    const pct = Math.round((v.waterMl / v.waterGoalMl) * 100)
    if (v.waterMl <= 0) {
      list.push({
        id: 'water-empty',
        tone: 'warn',
        title: 'Hidratação',
        body: 'Ainda sem água registada. Uma garrafa agora muda o resto do dia.',
      })
    } else if (!v.waterOk) {
      list.push({
        id: 'water-low',
        tone: 'warn',
        title: 'Hidratação',
        body: `${pct}% da meta (${v.waterMl}/${v.waterGoalMl} ml). Fecha o dia com mais um gole.`,
      })
    } else {
      list.push({
        id: 'water-ok',
        tone: 'ok',
        title: 'Hidratação',
        body: `Água no ponto (${v.waterMl} ml). ${v.waterWeekDays}/${v.weeklyGoals.waterDaysTarget} dias ok esta semana.`,
      })
    }
  }

  if (sleepDebt >= 3) {
    list.push({
      id: 'sleep-debt',
      tone: 'warn',
      title: 'Débito de sono',
      body: `Levas ~${sleepDebt}h de débito na semana. Prioriza deitar mais cedo 2–3 noites.`,
    })
  } else if (v.sleepHours === null) {
    list.push({
      id: 'sleep-miss',
      tone: 'info',
      title: 'Sono',
      body: 'Regista as horas — é o melhor predicador de energia e recuperação.',
    })
  } else if (!v.sleepOk) {
    list.push({
      id: 'sleep-low',
      tone: 'warn',
      title: 'Sono',
      body: `${v.sleepHours}h. O ideal fica entre 7 e 9. Hoje: volume de treino mais leve se fores treinar.`,
    })
  } else {
    list.push({
      id: 'sleep-ok',
      tone: 'ok',
      title: 'Sono',
      body: `${v.sleepHours}h — recuperação boa. ${v.sleepWeekDays}/${v.weeklyGoals.sleepDaysTarget} noites ok na semana.`,
    })
  }

  if (!v.trainedToday) {
    list.push({
      id: 'treino-miss',
      tone: 'info',
      title: 'Movimento',
      body: 'Sem treino marcado. Uma caminhada ou o plano do dia já conta.',
    })
  } else {
    list.push({
      id: 'treino-ok',
      tone: 'ok',
      title: 'Movimento',
      body: 'Treino feito. Consistência > perfeição.',
    })
  }

  if (v.kcal <= 0) {
    list.push({
      id: 'nutri-empty',
      tone: 'info',
      title: 'Nutrição',
      body: 'Diário vazio. Proteína + água no mesmo cartão: abre Nutrição e regista o próximo prato.',
    })
  } else if (v.protein > 0 && v.protein < 80) {
    list.push({
      id: 'protein-low',
      tone: 'warn',
      title: 'Nutrição',
      body: `${Math.round(v.protein)} g prot e ${v.waterMl} ml água. Sobe a proteína no próximo prato.`,
    })
  } else if (v.kcal > 0) {
    list.push({
      id: 'nutri-ok',
      tone: 'ok',
      title: 'Nutrição',
      body: `${v.kcal} kcal · ${Math.round(v.protein)} g prot · ${v.waterMl} ml água — panorama do dia.`,
    })
  }

  if (v.healthHabitsTotal > 0 && v.healthHabitsDone < v.healthHabitsTotal) {
    list.push({
      id: 'habits',
      tone: 'info',
      title: 'Hábitos de saúde',
      body: `${v.healthHabitsDone}/${v.healthHabitsTotal} hábitos de saúde feitos hoje.`,
    })
  }

  if (!v.checkInDone) {
    list.push({
      id: 'checkin',
      tone: 'info',
      title: 'Check-in',
      body: 'Como estás? Energia e humor em 10 segundos.',
    })
  }

  return list.slice(0, 6)
}

export function buildWeeklyInsights(v: VitalSignals, sleepDebt: number): HealthInsight[] {
  return [
    {
      id: 'week-water',
      tone: v.waterWeekDays >= v.weeklyGoals.waterDaysTarget ? 'ok' : 'warn',
      title: 'Semana · água',
      body: `${v.waterWeekDays} de ${v.weeklyGoals.waterDaysTarget} dias com meta de hidratação.`,
    },
    {
      id: 'week-sleep',
      tone: v.sleepWeekDays >= v.weeklyGoals.sleepDaysTarget ? 'ok' : 'warn',
      title: 'Semana · sono',
      body:
        sleepDebt >= 3
          ? `${v.sleepWeekDays} noites ok · débito ~${sleepDebt}h.`
          : `${v.sleepWeekDays} de ${v.weeklyGoals.sleepDaysTarget} noites entre 7–9h.`,
    },
  ]
}

/** Consulta rápida → plano do dia. */
export function runQuickConsult(q1: string, q2: string, q3: string): QuickConsult {
  const a1 = q1.toLowerCase()
  const a2 = q2.toLowerCase()
  const a3 = q3.toLowerCase()
  const plan: string[] = []

  if (/cans|sono|exaust|fatig/.test(a1)) {
    plan.push('Prioriza 7–9h de sono esta noite e treino mais leve se fores à academia.')
  } else if (/bem|ótimo|otimo|energia|dispos/.test(a1)) {
    plan.push('Energia boa — bom dia para treino completo e fechar a meta de proteína.')
  } else {
    plan.push('Faz um check-in de energia e bebe água nas próximas 2 horas.')
  }

  if (/dor|sintoma|febre|alerg|enxaqueca|grip/.test(a2)) {
    plan.push('Com sintomas: reduz intensidade, hidrata e regista no check-in. Se piorar, procura um profissional.')
  } else if (/nada|não|nao|sem/.test(a2)) {
    plan.push('Sem sintomas — mantém rotina de sono, água e movimento.')
  } else {
    plan.push('Anota o sintoma no check-in para ver o padrão na semana.')
  }

  if (/peso|emagrec|definir/.test(a3)) {
    plan.push('Meta de corpo: regista peso hoje e cumpre proteína + déficit calórico moderado.')
  } else if (/força|músculo|musculo|hipertrof/.test(a3)) {
    plan.push('Foco em força: treino de qualidade, proteína no alvo e sono para recuperar.')
  } else if (/stress|ansied|mente|foco/.test(a3)) {
    plan.push('Mente: 10 min sem ecrã, caminhada curta e deitar à hora do lembrete de sono.')
  } else {
    plan.push('Objetivo do dia: água na meta + um registo no diário alimentar.')
  }

  return {
    dateKey: dateKey(),
    q1: q1.trim(),
    q2: q2.trim(),
    q3: q3.trim(),
    plan,
  }
}

export function normalizeSex(raw: unknown): BodySex | null {
  if (raw === 'm' || raw === 'f' || raw === 'outro') return raw
  return null
}

export function defaultWeeklyGoals(
  raw?: Partial<WeeklyHealthGoals>,
): WeeklyHealthGoals {
  return {
    waterDaysTarget: Math.max(
      1,
      Math.min(7, Number(raw?.waterDaysTarget) || 5),
    ),
    sleepDaysTarget: Math.max(
      1,
      Math.min(7, Number(raw?.sleepDaysTarget) || 5),
    ),
  }
}

/** Comprime imagem para data URL JPEG (máx. ~900px). */
export async function compressImageFile(
  file: File,
  maxEdge = 900,
  quality = 0.72,
): Promise<{ dataUrl: string; name: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return { dataUrl, name: file.name }
}
