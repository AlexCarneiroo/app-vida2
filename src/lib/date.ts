export function dateKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Soma ou subtrai dias a um YYYY-MM-DD. */
export function shiftDateKey(key: string, deltaDays: number) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + deltaDays)
  return dateKey(date)
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

export function startOfWeek(d = new Date()) {
  const copy = new Date(d)
  const day = copy.getDay()
  copy.setHours(0, 0, 0, 0)
  copy.setDate(copy.getDate() - day)
  return copy
}

export function weekDates(from = new Date()) {
  const start = startOfWeek(from)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export function formatKg(n: number) {
  if (n === 0) return '—'
  return `${n} kg`
}

export function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  })
}

/** Exibe YYYY-MM-DD como DD/MM/YYYY. */
export function formatDateBR(key: string) {
  const [y, m, d] = key.split('-')
  if (!y || !m || !d) return key
  return `${d}/${m}/${y}`
}

/** Aceita 10,50 / 1.234,56 / 10.5 enquanto o utilizador digita. */
export function parseBRLInput(raw: string): number | null {
  let s = raw.trim().replace(/r\$\s?/gi, '').replace(/\s/g, '')
  if (!s) return null

  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  }

  const n = Number(s)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

/** Filtra teclas inválidas sem limpar o campo a meio da escrita. */
export function sanitizeMoneyTyping(raw: string) {
  let s = raw.replace(/[^\d.,]/g, '')
  const sep = s.includes(',') ? ',' : s.includes('.') ? '.' : null
  if (!sep) return s.replace(/^0+(?=\d)/, '') || s

  const first = s.indexOf(sep)
  const intPart = s.slice(0, first).replace(/[.,]/g, '')
  let decPart = s.slice(first + 1).replace(/[.,]/g, '').slice(0, 2)
  // permite "10," / "10." a meio
  if (s.endsWith(sep) && decPart === '') return `${intPart}${sep}`
  return `${intPart}${sep}${decPart}`
}

export function formatDuration(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
