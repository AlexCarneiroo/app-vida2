import { calcImc, imcLabel, latestMetric } from '../data/saudeDefaults'
import type { SaudeState } from '../types/saude'
import { dateKey } from './date'

export async function exportHealthPdf(input: {
  state: SaudeState
  waterMl: number
  waterGoalMl: number
  score: number
  sleepDebt: number
}) {
  const { jsPDF } = await import('jspdf')
  const { state, waterMl, waterGoalMl, score, sleepDebt } = input
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 16
  let y = 18
  const today = dateKey()

  const line = (text: string, bold = false) => {
    if (y > 275) {
      doc.addPage()
      y = 18
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 11 : 9.5)
    doc.setTextColor(bold ? 10 : 40, bold ? 61 : 40, bold ? 58 : 40)
    const lines = doc.splitTextToSize(text, pageW - margin * 2)
    doc.text(lines, margin, y)
    y += lines.length * (bold ? 6 : 5) + 1.5
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(10, 61, 58)
  doc.text('VIDA — Resumo de saúde', margin, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  doc.text(`Gerado em ${today} · Score vitalidade: ${score}`, margin, y)
  y += 8
  doc.setDrawColor(45, 212, 168)
  doc.setLineWidth(0.4)
  doc.line(margin, y, pageW - margin, y)
  y += 8

  const last = latestMetric(state.metrics)
  const imc =
    last && state.heightCm > 0
      ? calcImc(last.weightKg, state.heightCm)
      : null

  line('Corpo', true)
  line(
    `Altura: ${state.heightCm || '—'} cm · Peso: ${last ? `${last.weightKg} kg` : '—'} · Meta: ${state.weightGoalKg || '—'} kg`,
  )
  if (imc !== null) line(`IMC: ${imc} (${imcLabel(imc)})`)
  if (last?.waistCm) line(`Cintura: ${last.waistCm} cm`)
  if (last?.bodyFatPct) line(`% gordura: ${last.bodyFatPct}`)
  y += 2

  line('Hidratação & sono', true)
  line(`Água hoje: ${waterMl} / ${waterGoalMl} ml`)
  line(`Débito de sono (7d): ~${sleepDebt} h`)
  const recentSleep = [...state.sleep]
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    .slice(0, 7)
  for (const s of recentSleep) {
    line(
      `${s.dateKey}: ${s.hours}h · qualidade ${s.quality}/5${s.bedTime ? ` · ${s.bedTime}` : ''}`,
    )
  }
  y += 2

  line('Exames', true)
  if (state.exams.length === 0) line('Sem exames registados.')
  else {
    for (const e of state.exams.slice(0, 25)) {
      line(
        `${e.dateKey} · ${e.name}: ${e.value}${e.unit ? ` ${e.unit}` : ''}${e.refRange ? ` (ref ${e.refRange})` : ''}${e.nextDueDateKey ? ` · refazer ${e.nextDueDateKey}` : ''}`,
      )
    }
  }
  y += 2

  line('Medicação / suplementos', true)
  if (state.medications.length === 0) line('Nenhum registo.')
  else {
    for (const m of state.medications) {
      line(`${m.time} · ${m.name}${m.dose ? ` (${m.dose})` : ''}`)
    }
  }
  y += 2

  line('Check-ins recentes', true)
  const checks = [...state.checkIns]
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    .slice(0, 10)
  if (checks.length === 0) line('Sem check-ins.')
  else {
    for (const c of checks) {
      line(
        `${c.dateKey}: energia ${c.energy}/5 · humor ${c.mood}/5${c.symptoms ? ` · ${c.symptoms}` : ''}`,
      )
    }
  }
  y += 4
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(
    'Documento gerado pela app VIDA. Não substitui avaliação médica profissional.',
    margin,
    Math.min(y, 285),
  )

  doc.save(`vida-saude-${today}.pdf`)
}
