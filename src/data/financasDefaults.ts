import type {
  CategoryBudget,
  FinanceCategory,
  FinancasState,
  RecurringBill,
  TxType,
} from '../types/financas'

export const INCOME_CATEGORIES: FinanceCategory[] = [
  'salário',
  'freelance',
  'investimentos',
  'outros',
]

export const EXPENSE_CATEGORIES: FinanceCategory[] = [
  'moradia',
  'alimentação',
  'transporte',
  'saúde',
  'lazer',
  'compras',
  'educação',
  'outros',
]

export const CATEGORY_LABELS: Record<FinanceCategory, string> = {
  salário: 'Salário',
  freelance: 'Freelance',
  investimentos: 'Investimentos',
  moradia: 'Moradia',
  alimentação: 'Alimentação',
  transporte: 'Transporte',
  saúde: 'Saúde',
  lazer: 'Lazer',
  compras: 'Compras',
  educação: 'Educação',
  outros: 'Outros',
}

export function categoriesForType(type: TxType): FinanceCategory[] {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}

export const emptyFinancasState: FinancasState = {
  transactions: [],
  goals: [],
  bills: [],
  budgets: [],
}

export function normalizeBudget(
  raw: Partial<CategoryBudget> & { id: string },
): CategoryBudget {
  return {
    id: raw.id,
    category: (raw.category || 'outros') as FinanceCategory,
    limit: Math.max(1, Number(raw.limit) || 1),
  }
}

export type BillIdea = {
  name: string
  amount: number
  dayOfMonth: number
  category: FinanceCategory
}

export const BILL_IDEAS: BillIdea[] = [
  { name: 'Netflix', amount: 55.9, dayOfMonth: 12, category: 'lazer' },
  { name: 'Spotify', amount: 21.9, dayOfMonth: 5, category: 'lazer' },
  { name: 'Academia', amount: 129.9, dayOfMonth: 1, category: 'saúde' },
  { name: 'Luz', amount: 180, dayOfMonth: 10, category: 'moradia' },
  { name: 'Internet', amount: 99.9, dayOfMonth: 8, category: 'moradia' },
  { name: 'Aluguel', amount: 1500, dayOfMonth: 5, category: 'moradia' },
]

export type BillInput = {
  name: string
  amount: number
  dayOfMonth: number
  category: FinanceCategory
  active?: boolean
  renewalDate?: string | null
  payDate?: string | null
}

export function clampBillDay(day: number) {
  const n = Math.round(Number(day) || 1)
  return Math.min(28, Math.max(1, n))
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function cleanBillDate(value: unknown): string | null {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null
  }
  return value
}

/** Próxima ocorrência do dia (1–28) a partir de hoje. */
export function nextBillDate(day: number, now = new Date()) {
  const d = clampBillDay(day)
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let due = new Date(cursor.getFullYear(), cursor.getMonth(), d)
  if (due < cursor) {
    due = new Date(cursor.getFullYear(), cursor.getMonth() + 1, d)
  }
  const y = due.getFullYear()
  const m = String(due.getMonth() + 1).padStart(2, '0')
  const dayStr = String(due.getDate()).padStart(2, '0')
  return `${y}-${m}-${dayStr}`
}

export function normalizeBill(raw: Partial<RecurringBill> & { id: string }): RecurringBill {
  const payDate = cleanBillDate(raw.payDate)
  const renewalDate = cleanBillDate(raw.renewalDate)
  const dayFromPay = payDate ? Number(payDate.slice(8, 10)) : null
  return {
    id: raw.id,
    name: (raw.name || 'Conta').trim() || 'Conta',
    amount: Math.max(0.01, Number(raw.amount) || 0.01),
    dayOfMonth: clampBillDay(dayFromPay ?? raw.dayOfMonth ?? 1),
    renewalDate,
    payDate,
    category: (raw.category || 'outros') as FinanceCategory,
    active: raw.active !== false,
    lastPaidMonth:
      typeof raw.lastPaidMonth === 'string' &&
      /^\d{4}-\d{2}$/.test(raw.lastPaidMonth)
        ? raw.lastPaidMonth
        : null,
    createdAt: raw.createdAt || new Date().toISOString(),
  }
}
