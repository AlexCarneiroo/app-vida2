import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** Extrai texto de um PDF (extratos com texto selecionável). */
export async function extractPdfText(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const parts: string[] = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()
    const lineMap = new Map<number, string[]>()

    for (const item of content.items) {
      if (!('str' in item) || !item.str?.trim()) continue
      const y = Math.round((item.transform?.[5] ?? 0) * 10) / 10
      const bucket = Math.round(y)
      const arr = lineMap.get(bucket) ?? []
      arr.push(item.str)
      lineMap.set(bucket, arr)
    }

    const lines = [...lineMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, words]) => words.join(' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean)

    parts.push(lines.join('\n'))
  }

  return parts.join('\n')
}
