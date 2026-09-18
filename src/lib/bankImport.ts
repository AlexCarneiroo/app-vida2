import { uid } from './storage'
import type { FinanceCategory, TxType } from '../types/financas'

export type ImportDraft = {
  id: string
  type: TxType
  amount: number
  category: FinanceCategory
  note: string
  dateKey: string
  selected: boolean
}

export type ParseResult = {
  drafts: ImportDraft[]
  detectedMonth: string | null
  source: 'csv' | 'ofx' | 'pdf' | 'txt' | 'unknown'
  warnings: string[]
}

const EXPENSE_KEYWORDS: Array<{ keys: string[]; category: FinanceCategory }> = [
  { keys: ['mercado', 'ifood', 'rappi', 'padaria', 'supermerc', 'restaurante', 'cafe', 'café'], category: 'alimentação' },
  { keys: ['uber', '99', 'combust', 'posto', 'estacion', 'pedagio', 'pedágio', 'metro', 'ônibus', 'onibus'], category: 'transporte' },
  { keys: ['aluguel', 'condomin', 'energia', 'luz', 'agua', 'água', 'internet', 'vivo', 'claro', 'tim', 'netflix'], category: 'moradia' },
  { keys: ['farmac', 'drog', 'hospital', 'clinica', 'clínica', 'plano de saude', 'plano de saúde', 'dent'], category: 'saúde' },
  { keys: ['cinema', 'spotify', 'steam', 'jogo', 'bar ', 'show', 'ingresso'], category: 'lazer' },
  { keys: ['amazon', 'shopee', 'magazine', 'americanas', 'ml ', 'mercado livre', 'compra'], category: 'compras' },
  { keys: ['curso', 'udemy', 'escola', 'faculdade', 'mensalidade'], category: 'educação' },
]

const INCOME_KEYWORDS: Array<{ keys: string[]; category: FinanceCategory }> = [
  { keys: ['salario', 'salário', 'folha', 'pagamento'], category: 'salário' },
  { keys: ['pix recebido', 'transferencia recebida', 'transferência recebida', 'ted receb'], category: 'outros' },
  { keys: ['rendimento', 'dividend', 'juros', 'aplicacao', 'aplicação'], category: 'investimentos' },
  { keys: ['freelance', 'honorario', 'honorário', 'servico', 'serviço'], category: 'freelance' },
]

function monthFromDateKey(dateKey: string) {
  return dateKey.slice(0, 7)
}

export function guessCategory(type: TxType, note: string): FinanceCategory {
  const text = note.toLowerCase()
  const list = type === 'income' ? INCOME_KEYWORDS : EXPENSE_KEYWORDS
  for (const row of list) {
    if (row.keys.some((k) => text.includes(k))) return row.category
  }
  return type === 'income' ? 'outros' : 'outros'
}

function parseAmount(raw: string): number | null {
  let s = raw.trim()
  if (!s) return null
  s = s.replace(/r\$\s?/gi, '').replace(/\s/g, '')
  // (1.234,56) accounting negative
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-')
  s = s.replace(/[()]/g, '').replace(/^\+/, '')

  if (s.includes(',') && s.includes('.')) {
    // 1.234,56
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  }

  const n = Number(s)
  if (!Number.isFinite(n) || n === 0) return null
  return neg ? -Math.abs(n) : n
}

function parseDate(raw: string): string | null {
  const s = raw.trim()
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  // DD/MM/YYYY or DD-MM-YYYY
  const br = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/)
  if (br) {
    const d = br[1].padStart(2, '0')
    const m = br[2].padStart(2, '0')
    let y = br[3]
    if (y.length === 2) y = `20${y}`
    return `${y}-${m}-${d}`
  }
  // OFX YYYYMMDD
  const ofx = s.match(/^(\d{4})(\d{2})(\d{2})/)
  if (ofx) return `${ofx[1]}-${ofx[2]}-${ofx[3]}`
  return null
}

function detectDelimiter(headerLine: string) {
  const semis = (headerLine.match(/;/g) || []).length
  const commas = (headerLine.match(/,/g) || []).length
  return semis >= commas ? ';' : ','
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur.trim())
  return out.map((c) => c.replace(/^"|"$/g, ''))
}

function normalizeHeader(h: string) {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function findCol(headers: string[], candidates: string[]) {
  const normalized = headers.map(normalizeHeader)
  for (const c of candidates) {
    const i = normalized.indexOf(normalizeHeader(c))
    if (i >= 0) return i
  }
  // partial
  for (let i = 0; i < normalized.length; i++) {
    if (candidates.some((c) => normalized[i].includes(normalizeHeader(c)))) {
      return i
    }
  }
  return -1
}

function parseCsv(text: string): ParseResult {
  const warnings: string[] = []
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    return { drafts: [], detectedMonth: null, source: 'csv', warnings: ['CSV vazio ou inválido.'] }
  }

  const delimiter = detectDelimiter(lines[0])
  const headers = splitCsvLine(lines[0], delimiter)
  const dateIdx = findCol(headers, ['data', 'date', 'dtlancamento', 'datalancamento', 'posted'])
  const descIdx = findCol(headers, [
    'descricao',
    'descrição',
    'historico',
    'histórico',
    'memo',
    'titulo',
    'título',
    'estabelecimento',
    'lancamento',
    'lançamento',
    'name',
  ])
  const amountIdx = findCol(headers, [
    'valor',
    'amount',
    'quantia',
    'vlr',
    'montante',
  ])
  const typeIdx = findCol(headers, ['tipo', 'type', 'natureza', 'entrada/saida', 'entradasaida'])

  if (dateIdx < 0 || amountIdx < 0) {
    return {
      drafts: [],
      detectedMonth: null,
      source: 'csv',
      warnings: [
        'Não encontrei colunas de Data e Valor. Exporte CSV com cabeçalhos (Data, Descrição, Valor).',
      ],
    }
  }

  const drafts: ImportDraft[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter)
    const dateKey = parseDate(cols[dateIdx] ?? '')
    const amountRaw = parseAmount(cols[amountIdx] ?? '')
    if (!dateKey || amountRaw === null) continue

    const note = (descIdx >= 0 ? cols[descIdx] : '') || 'Importado do banco'
    let type: TxType =
      amountRaw < 0 ? 'expense' : 'income'

    if (typeIdx >= 0) {
      const t = (cols[typeIdx] ?? '').toLowerCase()
      if (/saida|saída|debit|d[eé]bito|expense|-/.test(t)) type = 'expense'
      if (/entrada|credit|cr[eé]dito|income|\+/.test(t)) type = 'income'
    }

    const amount = Math.abs(amountRaw)
    drafts.push({
      id: uid('imp'),
      type,
      amount,
      category: guessCategory(type, note),
      note: note.slice(0, 120),
      dateKey,
      selected: true,
    })
  }

  if (drafts.length === 0) {
    warnings.push('Nenhuma linha válida encontrada no CSV.')
  }

  const months = drafts.map((d) => monthFromDateKey(d.dateKey))
  const detectedMonth = mostCommon(months)

  return { drafts, detectedMonth, source: 'csv', warnings }
}

function parseOfx(text: string): ParseResult {
  const warnings: string[] = []
  const drafts: ImportDraft[] = []
  const blocks = text.split(/<STMTTRN>/i).slice(1)

  for (const block of blocks) {
    const dateMatch = block.match(/<DTPOSTED>([^<\s]+)/i)
    const amtMatch = block.match(/<TRNAMT>([^<\s]+)/i)
    const memoMatch =
      block.match(/<MEMO>([^<]+)/i) ||
      block.match(/<NAME>([^<]+)/i) ||
      block.match(/<PAYEE>([^<]+)/i)

    if (!dateMatch || !amtMatch) continue
    const dateKey = parseDate(dateMatch[1])
    const amountRaw = parseAmount(amtMatch[1])
    if (!dateKey || amountRaw === null) continue

    const note = (memoMatch?.[1] ?? 'Importado OFX').trim()
    const type: TxType = amountRaw < 0 ? 'expense' : 'income'
    drafts.push({
      id: uid('imp'),
      type,
      amount: Math.abs(amountRaw),
      category: guessCategory(type, note),
      note: note.slice(0, 120),
      dateKey,
      selected: true,
    })
  }

  if (drafts.length === 0) {
    warnings.push('Nenhuma transação OFX encontrada.')
  }

  const detectedMonth = mostCommon(drafts.map((d) => monthFromDateKey(d.dateKey)))
  return { drafts, detectedMonth, source: 'ofx', warnings }
}

function mostCommon(items: string[]): string | null {
  if (items.length === 0) return null
  const map = new Map<string, number>()
  for (const i of items) map.set(i, (map.get(i) ?? 0) + 1)
  return [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

const AMOUNT_TAIL =
  /(-?\(?R?\$?\s*[\d.]+,\d{2}\)?-?|\(?-?[\d.]+,\d{2}\)?)\s*([CDcd])?\s*$/

function inferYear(text: string): number {
  const years = [...text.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]))
  if (years.length === 0) return new Date().getFullYear()
  const common = mostCommon(years.map(String))
  return common ? Number(common) : new Date().getFullYear()
}

function completeDate(raw: string, yearHint: number): string | null {
  const full = parseDate(raw)
  if (full) return full
  const short = raw.trim().match(/^(\d{1,2})[\/\-.](\d{1,2})$/)
  if (!short) return null
  const d = short[1].padStart(2, '0')
  const m = short[2].padStart(2, '0')
  return `${yearHint}-${m}-${d}`
}

/** Extrai lançamentos de texto livre (PDF / TXT de extrato). */
export function parseStatementText(
  text: string,
  source: ParseResult['source'] = 'txt',
): ParseResult {
  const warnings: string[] = []
  const drafts: ImportDraft[] = []
  const yearHint = inferYear(text)
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (
      /saldo|extrato|ag[eê]ncia|conta|p[aá]gina|per[ií]odo|total|documento|cpf|cnpj|banco|cliente|emiss/i.test(
        line,
      ) &&
      !AMOUNT_TAIL.test(line)
    ) {
      continue
    }

    const dateAtStart = line.match(
      /^(\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?)\s+(.+)$/,
    )
    if (!dateAtStart) continue

    const dateKey = completeDate(dateAtStart[1], yearHint)
    if (!dateKey) continue

    let rest = dateAtStart[2]
    let amountMatch = rest.match(AMOUNT_TAIL)

    // valor na linha seguinte
    if (!amountMatch && lines[i + 1]) {
      const nextAmt = lines[i + 1].match(AMOUNT_TAIL)
      if (nextAmt) {
        amountMatch = nextAmt
        rest = `${rest} ${lines[i + 1]}`
        i++
      }
    }
    if (!amountMatch) continue

    const amountRaw = parseAmount(amountMatch[1])
    if (amountRaw === null) continue

    let note = rest.slice(0, rest.length - amountMatch[0].length).trim()
    note = note.replace(/\s+/g, ' ').replace(/[-–—]\s*$/, '').trim()
    if (!note || note.length < 2) note = 'Lançamento do extrato'

    let type: TxType = amountRaw < 0 ? 'expense' : 'income'
    const flag = (amountMatch[2] || '').toUpperCase()
    if (flag === 'D') type = 'expense'
    if (flag === 'C') type = 'income'
    // muitos extratos BR: valores positivos e "D"/"C", ou débito sem sinal
    if (!flag && /debito|débito|compra|pagamento|pix env|transferencia envi/i.test(note)) {
      type = 'expense'
    }
    if (!flag && /credito|crédito|salario|salário|pix receb|rendimento/i.test(note)) {
      type = 'income'
    }

    drafts.push({
      id: uid('imp'),
      type,
      amount: Math.abs(amountRaw),
      category: guessCategory(type, note),
      note: note.slice(0, 120),
      dateKey,
      selected: true,
    })
  }

  // dedupe identical consecutive
  const unique: ImportDraft[] = []
  const seen = new Set<string>()
  for (const d of drafts) {
    const key = `${d.dateKey}|${d.amount}|${d.note}|${d.type}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(d)
  }

  if (unique.length === 0) {
    warnings.push(
      source === 'pdf'
        ? 'Não encontrei lançamentos no PDF. Use um extrato com texto selecionável (não digitalizado) ou exporte CSV/OFX.'
        : 'Não encontrei lançamentos no ficheiro.',
    )
  }

  return {
    drafts: unique,
    detectedMonth: mostCommon(unique.map((d) => monthFromDateKey(d.dateKey))),
    source,
    warnings,
  }
}

export async function parseBankFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()

  // PDF
  if (name.endsWith('.pdf') || type.includes('pdf')) {
    try {
      const { extractPdfText } = await import('./pdfExtract')
      const text = await extractPdfText(file)
      if (!text.trim()) {
        return {
          drafts: [],
          detectedMonth: null,
          source: 'pdf',
          warnings: [
            'O PDF não tem texto legível (pode ser imagem digitalizada). Exporte CSV/OFX no app do banco.',
          ],
        }
      }
      // se o PDF na verdade embute CSV-like
      if ((text.match(/;/g) || []).length > 5 && /data|valor/i.test(text)) {
        const csv = parseCsv(text)
        if (csv.drafts.length) return { ...csv, source: 'pdf' }
      }
      return parseStatementText(text, 'pdf')
    } catch {
      return {
        drafts: [],
        detectedMonth: null,
        source: 'pdf',
        warnings: ['Falha ao ler o PDF. Tente CSV ou OFX.'],
      }
    }
  }

  const buffer = await file.arrayBuffer()
  const text = new TextDecoder('utf-8').decode(buffer)
  // fallback encoding issues: try latin1 if lots of replacement chars
  const decoded =
    (text.match(/\uFFFD/g) || []).length > 5
      ? new TextDecoder('latin1').decode(buffer)
      : text

  const looksOfx =
    name.endsWith('.ofx') ||
    name.endsWith('.qfx') ||
    /<OFX|<STMTTRN|<BANKTRANLIST/i.test(decoded)

  if (looksOfx) return parseOfx(decoded)

  if (
    name.endsWith('.csv') ||
    name.endsWith('.txt') ||
    type.includes('csv') ||
    type.includes('text')
  ) {
    // prefer CSV if header-like
    if (/data|valor|descricao|descrição|historico/i.test(decoded.split(/\r?\n/)[0] ?? '')) {
      const csv = parseCsv(decoded)
      if (csv.drafts.length) return csv
    }
    if (name.endsWith('.csv')) return parseCsv(decoded)
    return parseStatementText(decoded, 'txt')
  }

  if (/<STMTTRN/i.test(decoded)) return parseOfx(decoded)
  if (decoded.includes(';') || decoded.includes(',')) {
    const csv = parseCsv(decoded)
    if (csv.drafts.length) return csv
  }
  return parseStatementText(decoded, 'unknown')
}

/** Mantém o dia; troca ano-mês para o mês alvo (ex.: 2026-02). */
export function applyMonthToDrafts(
  drafts: ImportDraft[],
  monthKey: string,
): ImportDraft[] {
  const [y, m] = monthKey.split('-')
  return drafts.map((d) => {
    const day = d.dateKey.slice(8, 10) || '01'
    // clamp day for shorter months
    const maxDay = new Date(Number(y), Number(m), 0).getDate()
    const safeDay = String(Math.min(Number(day), maxDay)).padStart(2, '0')
    return { ...d, dateKey: `${y}-${m}-${safeDay}` }
  })
}

export function monthOptions(around = new Date(), count = 18): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(around.getFullYear(), around.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    out.push(`${y}-${m}`)
  }
  return out
}

export function formatMonthLabel(monthKey: string) {
  const [y, m] = monthKey.split('-').map(Number)
  const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}
