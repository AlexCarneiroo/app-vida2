import * as pdfjs from 'pdfjs-dist'

/** Worker do PDF.js — Vite resolve o URL em build e dev. */
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export class PdfPasswordError extends Error {
  readonly reason: 'need' | 'incorrect'

  constructor(reason: 'need' | 'incorrect') {
    super(
      reason === 'incorrect'
        ? 'Senha incorreta'
        : 'PDF protegido por senha',
    )
    this.name = 'PdfPasswordError'
    this.reason = reason
  }
}

type TextChunk = { str: string; x: number; y: number; hasEOL: boolean }

function isPasswordError(err: unknown): PdfPasswordError | null {
  if (!err || typeof err !== 'object') return null
  const e = err as { name?: string; message?: string; code?: number }
  const msg = String(e.message ?? '')
  const name = String(e.name ?? '')
  if (name !== 'PasswordException' && !/password/i.test(msg)) return null
  const incorrect =
    e.code === pdfjs.PasswordResponses.INCORRECT_PASSWORD ||
    /incorrect/i.test(msg)
  return new PdfPasswordError(incorrect ? 'incorrect' : 'need')
}

/**
 * Extrai texto de um PDF bancário preservando linhas (Y) e ordem (X).
 * Aceita senha para extratos protegidos (ex.: CPF).
 */
export async function extractPdfText(
  file: File,
  password?: string,
): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer())

  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>
  try {
    doc = await pdfjs.getDocument({
      data,
      password: password ?? '',
      useSystemFonts: true,
    }).promise
  } catch (err) {
    const pwdErr = isPasswordError(err)
    if (pwdErr) throw pwdErr
    throw err
  }

  const pages: string[] = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent({
      includeMarkedContent: false,
    })

    const chunks: TextChunk[] = []
    for (const item of content.items) {
      if (!('str' in item) || typeof item.str !== 'string') continue
      const str = item.str
      if (!str.replace(/\s/g, '')) continue
      const transform = item.transform
      chunks.push({
        str,
        x: transform?.[4] ?? 0,
        y: transform?.[5] ?? 0,
        hasEOL: Boolean(item.hasEOL),
      })
    }

    if (chunks.length === 0) {
      pages.push('')
      continue
    }

    const sorted = [...chunks].sort((a, b) => {
      const dy = b.y - a.y
      if (Math.abs(dy) > 2.5) return dy
      return a.x - b.x
    })

    const lines: string[] = []
    let currentY = sorted[0].y
    let current: TextChunk[] = []

    const flush = () => {
      if (current.length === 0) return
      current.sort((a, b) => a.x - b.x)
      let line = ''
      let lastRight = -Infinity
      for (const c of current) {
        const gap = c.x - lastRight
        if (line && gap > 1.2) line += ' '
        line += c.str
        lastRight = c.x + c.str.length * 4
        if (c.hasEOL) {
          lines.push(line.replace(/\s+/g, ' ').trim())
          line = ''
          lastRight = -Infinity
        }
      }
      const cleaned = line.replace(/\s+/g, ' ').trim()
      if (cleaned) lines.push(cleaned)
      current = []
    }

    for (const c of sorted) {
      if (Math.abs(c.y - currentY) > 2.5) {
        flush()
        currentY = c.y
      }
      current.push(c)
    }
    flush()

    pages.push(lines.filter(Boolean).join('\n'))
  }

  return pages.filter(Boolean).join('\n\n')
}
