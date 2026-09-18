import type { FinanceCategory, FinancasState, TxType } from '../types/financas'

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
}
