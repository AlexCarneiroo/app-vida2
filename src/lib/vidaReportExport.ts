import type { ReportSection } from './vidaReport'

export async function exportVidaReportPdf(input: {
  label: string
  startKey: string
  endKey: string
  sections: ReportSection[]
}) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 16
  const maxW = pageW - margin * 2
  let y = 18

  const ensure = (need = 12) => {
    if (y + need <= pageH - 16) return
    doc.addPage()
    y = 18
  }

  const write = (text: string, size: number, bold = false, color: [number, number, number] = [40, 40, 40]) => {
    ensure(size + 4)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(color[0], color[1], color[2])
    const lines = doc.splitTextToSize(text, maxW)
    doc.text(lines, margin, y)
    y += lines.length * (size * 0.45) + 1.6
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(10, 61, 58)
  doc.text('VIDA — Relatório', margin, y)
  y += 7
  write(input.label, 11, false, [80, 80, 80])
  const names = input.sections.map((s) => s.title).join(', ')
  write(names || 'Nenhuma secção', 9, false, [110, 110, 110])

  doc.setDrawColor(45, 212, 168)
  doc.setLineWidth(0.4)
  ensure(6)
  doc.line(margin, y, pageW - margin, y)
  y += 8

  if (input.sections.length === 0) {
    write('Nenhuma secção selecionada.', 10)
  }

  for (const section of input.sections) {
    ensure(18)
    write(section.title, 13, true, [10, 61, 58])
    write(`${section.headline} · ${section.caption}`, 10, true)
    write(section.note, 9, false, [90, 90, 90])
    for (const row of section.rows) {
      ensure(6)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(40, 40, 40)
      doc.text(row.label, margin, y)
      const value = doc.splitTextToSize(row.value, maxW * 0.55)
      doc.text(value, pageW - margin, y, { align: 'right' })
      y += Math.max(5, value.length * 4.2)
    }
    if (section.items.length > 0) {
      y += 1.5
      write('Detalhe', 10, true)
      for (const item of section.items) {
        ensure(8)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(50, 50, 50)
        const left = doc.splitTextToSize(item.label, maxW * 0.68)
        doc.text(left, margin, y)
        doc.text(item.value, pageW - margin, y, { align: 'right' })
        y += left.length * 4 + 1.4
      }
    }
    y += 3
  }

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(140, 140, 140)
    doc.text(
      `Gerado pelo VIDA · ${new Date().toLocaleString('pt-BR')} · ${i}/${pages}`,
      margin,
      pageH - 8,
    )
  }

  doc.save(`vida-relatorio-${input.startKey}-${input.endKey}.pdf`)
}
