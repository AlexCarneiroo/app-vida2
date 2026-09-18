import { jsPDF } from 'jspdf'
import { CATEGORY_LABELS } from '../data/financasDefaults'
import type { MonthStats, Transaction } from '../types/financas'
import { formatMonthLabel } from './bankImport'

function money(n: number) {
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function exportMonthPdf(input: {
  monthKey: string
  transactions: Transaction[]
  stats: MonthStats
}) {
  const { monthKey, transactions, stats } = input
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 16
  let y = 18

  const title = `VIDA — Finanças`
  const subtitle = formatMonthLabel(monthKey)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(10, 61, 58)
  doc.text(title, margin, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(80, 80, 80)
  doc.text(subtitle, margin, y)
  y += 10

  doc.setDrawColor(45, 212, 168)
  doc.setLineWidth(0.4)
  doc.line(margin, y, pageW - margin, y)
  y += 8

  doc.setFontSize(10)
  doc.setTextColor(40, 40, 40)
  doc.text(`Entradas: ${money(stats.income)}`, margin, y)
  y += 5.5
  doc.text(`Saídas: ${money(stats.expense)}`, margin, y)
  y += 5.5
  doc.setFont('helvetica', 'bold')
  doc.text(`Saldo: ${money(stats.balance)}`, margin, y)
  y += 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Movimentos', margin, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  if (transactions.length === 0) {
    doc.setTextColor(120, 120, 120)
    doc.text('Sem movimentos neste mês.', margin, y)
  } else {
    for (const tx of transactions) {
      if (y > 275) {
        doc.addPage()
        y = 18
      }

      const sign = tx.type === 'income' ? '+' : '−'
      const cat = CATEGORY_LABELS[tx.category]
      const left = `${tx.dateKey}  ${cat}`
      const right = `${sign}${money(tx.amount)}`
      const note = tx.note ? tx.note.slice(0, 70) : ''

      doc.setTextColor(30, 30, 30)
      doc.text(left, margin, y)
      doc.text(right, pageW - margin, y, { align: 'right' })
      y += 4.2
      if (note) {
        doc.setTextColor(110, 110, 110)
        doc.text(note, margin, y)
        y += 4.2
      }
      y += 2.2
    }
  }

  if (stats.byCategory.length > 0) {
    if (y > 240) {
      doc.addPage()
      y = 18
    }
    y += 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(30, 30, 30)
    doc.text('Saídas por categoria', margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    for (const row of stats.byCategory) {
      if (y > 280) {
        doc.addPage()
        y = 18
      }
      doc.text(CATEGORY_LABELS[row.category], margin, y)
      doc.text(money(row.total), pageW - margin, y, { align: 'right' })
      y += 5
    }
  }

  y = Math.max(y + 8, 285)
  doc.setFontSize(8)
  doc.setTextColor(140, 140, 140)
  doc.text(
    `Gerado pelo VIDA · ${new Date().toLocaleString('pt-BR')}`,
    margin,
    290,
  )

  const filename = `vida-financas-${monthKey}.pdf`
  doc.save(filename)
}
