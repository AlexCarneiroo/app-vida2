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
  { keys: ['mercado', 'ifood', 'rappi', 'padaria', 'supermerc', 'restaurante', 'cafe', 'café', 'ifood'], category: 'alimentação' },
  { keys: ['uber', '99', 'combust', 'posto', 'estacion', 'pedagio', 'pedágio', 'metro', 'ônibus', 'onibus'], category: 'transporte' },
  { keys: ['aluguel', 'condomin', 'energia', 'luz', 'agua', 'água', 'internet', 'vivo', 'claro', 'tim', 'netflix', 'spotify'], category: 'moradia' },
  { keys: ['farmac', 'drog', 'hospital', 'clinica', 'clínica', 'plano de saude', 'plano de saúde', 'dent'], category: 'saúde' },
  { keys: ['cinema', 'steam', 'jogo', 'bar ', 'show', 'ingresso', 'disney', 'hbo'], category: 'lazer' },
  { keys: ['amazon', 'shopee', 'magazine', 'americanas', 'mercado livre', 'magalu', 'shein', 'aliexpress'], category: 'compras' },
  { keys: ['curso', 'udemy', 'escola', 'faculdade', 'mensalidade'], category: 'educação' },
]

const INCOME_KEYWORDS: Array<{ keys: string[]; category: FinanceCategory }> = [
  { keys: ['salario', 'salário', 'folha'], category: 'salário' },
  { keys: ['pix receb', 'transferencia receb', 'transferência receb', 'ted receb', 'deposito', 'depósito'], category: 'outros' },
  { keys: ['rendimento', 'dividend', 'juros', 'aplicacao', 'aplicação', 'cashback', 'estorno', 'reembolso'], category: 'investimentos' },
  { keys: ['freelance', 'honorario', 'honorário', 'servico', 'serviço'], category: 'freelance' },
]

const MONTH_NAME: Record<string, string> = {
  jan: '01',
  janeiro: '01',
  fev: '02',
  fevereiro: '02',
  mar: '03',
  marco: '03',
  março: '03',
  abr: '04',
  abril: '04',
  mai: '05',
  maio: '05',
  jun: '06',
  junho: '06',
  jul: '07',
  julho: '07',
  ago: '08',
  agosto: '08',
  set: '09',
  setembro: '09',
  out: '10',
  outubro: '10',
  nov: '11',
  novembro: '11',
  dez: '12',
  dezembro: '12',
}

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
  // 20 SET / 20 SET 2025 / 20 de setembro
  const named = s.match(
    /^(\d{1,2})\s*(?:de\s+)?([A-Za-zçãéúôáíó\.]+)(?:\s+(\d{2,4}))?/i,
  )
  if (named) {
    const key = named[2].replace(/\./g, '').toLowerCase()
    const m = MONTH_NAME[key]
    if (m) {
      const d = named[1].padStart(2, '0')
      let y = named[3] ?? ''
      if (!y) return null // precisa de ano via completeDate
      if (y.length === 2) y = `20${y}`
      return `${y}-${m}-${d}`
    }
  }
  // OFX YYYYMMDD
  const ofx = s.match(/^(\d{4})(\d{2})(\d{2})/)
  if (ofx) return `${ofx[1]}-${ofx[2]}-${ofx[3]}`
  return null
}

function completeDate(raw: string, yearHint: number): string | null {
  const full = parseDate(raw)
  if (full) return full
  const short = raw.trim().match(/^(\d{1,2})[\/\-.](\d{1,2})$/)
  if (short) {
    const d = short[1].padStart(2, '0')
    const m = short[2].padStart(2, '0')
    return `${yearHint}-${m}-${d}`
  }
  const named = raw
    .trim()
    .match(/^(\d{1,2})\s*(?:de\s+)?([A-Za-zçãéúôáíó\.]+)$/i)
  if (named) {
    const key = named[2].replace(/\./g, '').toLowerCase()
    const m = MONTH_NAME[key]
    if (m) return `${yearHint}-${m}-${named[1].padStart(2, '0')}`
  }
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

function findDescFromRow(
  cols: string[],
  dateIdx: number,
  amountIdx: number,
  typeIdx: number,
  descIdx: number,
): string {
  if (descIdx >= 0) {
    const v = (cols[descIdx] ?? '').trim()
    if (v) return v
  }
  // coluna de texto mais “rica” (nome do estabelecimento)
  let best = ''
  for (let i = 0; i < cols.length; i++) {
    if (i === dateIdx || i === amountIdx || i === typeIdx) continue
    const cell = (cols[i] ?? '').trim()
    if (!cell) continue
    if (parseDate(cell) || parseAmount(cell) !== null) continue
    if (/^\d+$/.test(cell)) continue
    const letters = (cell.match(/\p{L}/gu) || []).length
    if (letters >= 2 && cell.length > best.length) best = cell
  }
  return best
}

/** CSV real precisa de cabeçalho com data + valor + descrição. */
function looksLikeRealCsv(text: string): boolean {
  const first =
    text
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean) ?? ''
  if (!/[;,]/.test(first)) return false
  const headers = splitCsvLine(first, detectDelimiter(first)).map(normalizeHeader)
  if (headers.length < 3) return false
  const hasDate = headers.some((h) => /^(data|date|dtlancamento|datalancamento|posted)/.test(h) || h.includes('data'))
  const hasAmount = headers.some((h) => /valor|amount|quantia|vlr|montante/.test(h))
  const hasDesc = headers.some((h) =>
    /descricao|historico|memo|titulo|estabelecimento|lancamento|name/.test(h),
  )
  return hasDate && hasAmount && hasDesc
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

    const noteRaw = findDescFromRow(cols, dateIdx, amountIdx, typeIdx, descIdx)
    if (!noteRaw) continue

    let type: TxType = amountRaw < 0 ? 'expense' : 'income'

    if (typeIdx >= 0) {
      const t = (cols[typeIdx] ?? '').toLowerCase()
      if (/saida|saída|debit|d[eé]bito|expense|despesa|-/.test(t)) type = 'expense'
      if (/entrada|credit|cr[eé]dito|income|receita|\+/.test(t)) type = 'income'
    } else if (amountRaw > 0 && amountRaw === Math.abs(amountRaw)) {
      // CSV sem sinal e sem tipo → inferir pelo texto
      type = inferTxType(noteRaw, amountRaw, '')
    }

    const note = cleanStatementNote(noteRaw)
    drafts.push({
      id: uid('imp'),
      type,
      amount: Math.abs(amountRaw),
      category: guessCategory(type, note),
      note,
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

    const note = cleanStatementNote((memoMatch?.[1] ?? 'Importado OFX').trim())
    // OFX traz sinal: negativo = saída, positivo = entrada
    const type: TxType = amountRaw < 0 ? 'expense' : 'income'
    drafts.push({
      id: uid('imp'),
      type,
      amount: Math.abs(amountRaw),
      category: guessCategory(type, note),
      note,
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
  /(-?\(?R?\$?\s*[\d.]+,\d{2}\)?-?|\(?-?[\d.]+,\d{2}\)?-?)\s*([CDcd])?\s*$/

const AMOUNT_ANY =
  /(?:R\$\s*)?(-?\(?[\d.]{1,12},\d{2}\)?-?)(?:\s*([CDcd]))?/

const DATE_TOKEN =
  /(\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?|\d{1,2}\s*(?:de\s+)?(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zçãé]*)/i

const AMOUNT_ONLY =
  /^(?:R\$\s*)?(-?\(?[\d.]+,\d{2}\)?-?)\s*([CDcd])?$/i

function inferYear(text: string): number {
  const years = [...text.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]))
  if (years.length === 0) return new Date().getFullYear()
  const common = mostCommon(years.map(String))
  return common ? Number(common) : new Date().getFullYear()
}

function parseAmountLoose(raw: string): number | null {
  let s = raw.trim()
  const trailingMinus = /-\s*$/.test(s)
  s = s.replace(/-\s*$/, '')
  const n = parseAmount(s)
  if (n === null) return null
  if (trailingMinus) return -Math.abs(n)
  return n
}

function isNoiseLine(line: string) {
  if (AMOUNT_TAIL.test(line) || DATE_TOKEN.test(line)) return false
  return /saldo|extrato|ag[eê]ncia|conta corrente|p[aá]gina|per[ií]odo|total geral|documento|cpf|cnpj|banco|cliente|emiss|autentica|sacado|favorecido|comprovante|www\.|http|limite|vencimento|fatura\s+fechada/i.test(
    line,
  )
}

function isDateOnlyLine(line: string) {
  return /^(?:\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?|\d{1,2}\s*(?:de\s+)?(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zçãé]*(?:\s+\d{2,4})?)$/i.test(
    line.trim(),
  )
}

/** Limpa histórico bancário e tenta ficar com o nome útil (ex.: AMAZON). */
export function cleanStatementNote(raw: string): string {
  let n = raw.replace(/\s+/g, ' ').trim()
  n = n.replace(/[|•·]+/g, ' ')
  n = n.replace(/\bR\$\s*/gi, ' ')
  n = n.replace(/\b\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?\b/g, ' ')
  n = n.replace(
    /\b\d{1,2}\s*(?:de\s+)?(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zçãé]*\b/gi,
    ' ',
  )
  n = n.replace(/\b\d{6,}\b/g, ' ')
  n = n.replace(AMOUNT_ANY, ' ')
  n = n.replace(/\s+/g, ' ').trim()

  const named = n.match(
    /(?:PIX|TED|DOC|TEV|TRANSFER[EÊ]NCIA|PAGAMENTO|COMPRA|BOLETO|QR\s*CODE)[\s\wÀ-ú./-]{0,24}?[-–—:]\s*(.+)$/i,
  )
  const namedPart = named?.[1]?.trim()
  if (namedPart && namedPart.length >= 2) {
    n = namedPart
  } else {
    n = n
      .replace(
        /^(?:PIX|TED|DOC|TEV)\s*(?:QR\s*CODE|TRANSF(?:ER[EÊ]NCIA)?|ENV(?:IADO)?|RECEB(?:IDO|IMENTO)?|ENVIADA|RECEBIDA)?\s*/i,
        '',
      )
      .replace(
        /^(?:COMPRA(?:\s+NO)?\s+(?:D[EÉ]BITO|CR[EÉ]DITO|CART[AÃ]O)?|BOLETO)\s*/i,
        '',
      )
      .replace(/^(?:PAGAMENTO(?:\s+DE)?)\s+(?!recebido|efetuado|fatura)/i, '')
      .replace(/^[-–—:]\s*/, '')
      .trim()
  }

  n = n
    .replace(/\b(D|C)\b\s*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[-–—|/]+|[-–—|/]+$/g, '')
    .trim()

  if (n.length < 2) return 'Lançamento do extrato'
  if (n === n.toUpperCase() && /[A-ZÀ-Ú]/.test(n)) {
    n = n
      .toLowerCase()
      .replace(/(^|\s)([\p{L}])/gu, (_, s, c: string) => s + c.toUpperCase())
  }
  return n.slice(0, 120)
}

function inferTxType(
  note: string,
  amountRaw: number,
  flag: string,
): TxType {
  const f = flag.toUpperCase()
  const text = note.toLowerCase()

  if (f === 'D' || amountRaw < 0) return 'expense'
  if (f === 'C') return 'income'

  // créditos / estornos / pagamentos recebidos na fatura
  if (
    /\b(entrada|receita|cr[eé]dito|sal[aá]rio|folha|pix\s*receb|recebido|recebimento|transfer[eê]ncia\s*receb|dep[oó]sito|rendimento|estorno|cashback|reembolso|pagamento\s*(recebido|efetuado|fatura)|pgto\s*recebido)\b/i.test(
      text,
    )
  ) {
    return 'income'
  }
  if (
    /\b(sa[ií]da|despesa|d[eé]bito|pix\s*env|enviado|envio|transfer[eê]ncia\s*envi|compra|tarifa|anuidade|iof|boleto|saque)\b/i.test(
      text,
    )
  ) {
    return 'expense'
  }

  // Extratos BR sem C/D: positivo ≈ saída (compra)
  return 'expense'
}

function pushDraft(
  drafts: ImportDraft[],
  dateKey: string,
  noteRaw: string,
  amountRaw: number,
  flag: string,
) {
  const note = cleanStatementNote(noteRaw)
  if (note === 'Lançamento do extrato' && !noteRaw.replace(/\s/g, '')) return
  const type = inferTxType(`${noteRaw} ${note}`, amountRaw, flag)

  drafts.push({
    id: uid('imp'),
    type,
    amount: Math.abs(amountRaw),
    category: guessCategory(type, note),
    note,
    dateKey,
    selected: true,
  })
}

function extractAmountFromLine(line: string): {
  amount: number
  flag: string
  note: string
} | null {
  const only = line.match(AMOUNT_ONLY)
  if (only) {
    const amount = parseAmountLoose(only[1])
    if (amount === null) return null
    return { amount, flag: only[2] || '', note: '' }
  }
  const tail = line.match(AMOUNT_TAIL)
  if (!tail) return null
  const amount = parseAmountLoose(tail[1])
  if (amount === null) return null
  return {
    amount,
    flag: tail[2] || '',
    note: line.slice(0, line.length - tail[0].length).trim(),
  }
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
    if (isNoiseLine(line)) continue

    // A) data sozinha → linhas seguintes = nome + valor (comum em PDF de cartão)
    if (isDateOnlyLine(line)) {
      const dateKey = completeDate(line, yearHint)
      if (!dateKey) continue
      const noteParts: string[] = []
      let amountRaw: number | null = null
      let flag = ''
      let j = i + 1
      while (j < lines.length && j <= i + 4) {
        const next = lines[j]
        if (isDateOnlyLine(next)) break
        if (isNoiseLine(next) && !AMOUNT_TAIL.test(next)) {
          j++
          continue
        }
        const extracted = extractAmountFromLine(next)
        if (extracted && (!extracted.note || extracted.note.length < 2)) {
          amountRaw = extracted.amount
          flag = extracted.flag
          j++
          break
        }
        if (extracted && extracted.note) {
          noteParts.push(extracted.note)
          amountRaw = extracted.amount
          flag = extracted.flag
          j++
          break
        }
        noteParts.push(next)
        j++
      }
      if (amountRaw !== null) {
        pushDraft(drafts, dateKey, noteParts.join(' '), amountRaw, flag)
        i = j - 1
        continue
      }
    }

    // B) data no início da mesma linha
    const dateAtStart = line.match(
      /^(\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?|\d{1,2}\s*(?:de\s+)?(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zçãé]*(?:\s+\d{2,4})?)\s+(.+)$/i,
    )
    if (dateAtStart) {
      const dateKey = completeDate(dateAtStart[1], yearHint)
      if (!dateKey) continue

      let rest = dateAtStart[2]
      let extracted = extractAmountFromLine(rest)

      // valor / nome na linha seguinte
      if (!extracted && lines[i + 1]) {
        const next = lines[i + 1]
        if (!isDateOnlyLine(next)) {
          const nextExt = extractAmountFromLine(next)
          if (nextExt) {
            extracted = {
              amount: nextExt.amount,
              flag: nextExt.flag,
              note: [rest, nextExt.note].filter(Boolean).join(' '),
            }
            i++
          } else if (!AMOUNT_TAIL.test(rest) && AMOUNT_TAIL.test(next)) {
            // rest = nome, next = valor
            const amt = extractAmountFromLine(next)
            if (amt) {
              extracted = { amount: amt.amount, flag: amt.flag, note: rest }
              i++
            }
          } else {
            // rest pode ser data+parcial; next = continuação do nome; next+1 = valor
            if (lines[i + 2]) {
              const amt = extractAmountFromLine(lines[i + 2])
              if (amt && !isDateOnlyLine(next)) {
                extracted = {
                  amount: amt.amount,
                  flag: amt.flag,
                  note: [rest, next, amt.note].filter(Boolean).join(' '),
                }
                i += 2
              }
            }
          }
        }
      }

      if (!extracted) {
        const mid = [...rest.matchAll(new RegExp(AMOUNT_ANY.source, 'gi'))]
        const last = mid[mid.length - 1]
        if (last?.index != null) {
          const amountRaw = parseAmountLoose(last[1])
          if (amountRaw !== null) {
            extracted = {
              amount: amountRaw,
              flag: last[2] || '',
              note:
                rest.slice(0, last.index).trim() ||
                rest.slice(last.index + last[0].length),
            }
          }
        }
      }

      if (extracted) {
        pushDraft(
          drafts,
          dateKey,
          extracted.note || rest,
          extracted.amount,
          extracted.flag,
        )
      }
      continue
    }

    // C) data em qualquer sítio + valor no fim
    const dateAnywhere = line.match(DATE_TOKEN)
    const amountEnd = extractAmountFromLine(line)
    if (dateAnywhere && amountEnd && amountEnd.note) {
      const dateKey = completeDate(dateAnywhere[0], yearHint)
      if (!dateKey) continue
      const note = amountEnd.note
        .replace(dateAnywhere[0], ' ')
        .replace(/\s+/g, ' ')
        .trim()
      pushDraft(drafts, dateKey, note, amountEnd.amount, amountEnd.flag)
    }
  }

  // D) Varredura global (PDF que junta tudo)
  if (drafts.length < 2) {
    const flat = text.replace(/\s+/g, ' ')
    const globalRe =
      /(\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?|\d{1,2}\s+(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*)\s+(.{2,90}?)\s+(?:R\$\s*)?(-?\(?[\d.]+,\d{2}\)?-?)\s*([CDcd])?/gi
    let m: RegExpExecArray | null
    while ((m = globalRe.exec(flat)) !== null) {
      const dateKey = completeDate(m[1], yearHint)
      const amountRaw = parseAmountLoose(m[3])
      if (!dateKey || amountRaw === null) continue
      if (isNoiseLine(m[2])) continue
      pushDraft(drafts, dateKey, m[2], amountRaw, m[4] || '')
    }
  }

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
        ? 'Não encontrei lançamentos no PDF. Use extrato com texto selecionável (não foto/scan) ou exporte CSV/OFX no banco.'
        : 'Não encontrei lançamentos no ficheiro.',
    )
  } else if (source === 'pdf' && unique.length < 3) {
    warnings.push(
      'Poucos lançamentos detetados — confere a lista antes de guardar.',
    )
  }

  const nameless = unique.filter(
    (d) => d.note === 'Lançamento do extrato' || d.note === 'Importado do banco',
  ).length
  if (nameless > 0 && nameless === unique.length) {
    warnings.push(
      'Não consegui ler os nomes dos lançamentos. Confere ou edita na revisão.',
    )
  }

  return {
    drafts: unique,
    detectedMonth: mostCommon(unique.map((d) => monthFromDateKey(d.dateKey))),
    source,
    warnings,
  }
}

export async function parseBankFile(
  file: File,
  options?: { password?: string },
): Promise<ParseResult> {
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()

  // PDF
  if (name.endsWith('.pdf') || type.includes('pdf')) {
    try {
      const { extractPdfText } = await import('./pdfExtract')
      const text = await extractPdfText(file, options?.password)
      if (!text.trim()) {
        return {
          drafts: [],
          detectedMonth: null,
          source: 'pdf',
          warnings: [
            'O PDF não tem texto legível (pode ser imagem digitalizada). No app do banco, exporte CSV ou OFX.',
          ],
        }
      }
      if (looksLikeRealCsv(text)) {
        const csv = parseCsv(text)
        if (csv.drafts.length) return { ...csv, source: 'pdf' }
      }
      if (/<OFX>|<STMTTRN>/i.test(text)) {
        const ofx = parseOfx(text)
        if (ofx.drafts.length) return { ...ofx, source: 'pdf' }
      }
      return parseStatementText(text, 'pdf')
    } catch (err) {
      const { PdfPasswordError } = await import('./pdfExtract')
      if (err instanceof PdfPasswordError) throw err
      const msg =
        err instanceof Error ? err.message : 'Falha desconhecida ao ler PDF'
      if (/password/i.test(msg)) {
        throw new PdfPasswordError(
          /incorrect/i.test(msg) ? 'incorrect' : 'need',
        )
      }
      return {
        drafts: [],
        detectedMonth: null,
        source: 'pdf',
        warnings: [
          `Falha ao ler o PDF (${msg}). Tente CSV/OFX ou outro extrato com texto.`,
        ],
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
