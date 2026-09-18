export type TxType = 'income' | 'expense'

export type FinanceCategory =
  | 'salário'
  | 'freelance'
  | 'investimentos'
  | 'moradia'
  | 'alimentação'
  | 'transporte'
  | 'saúde'
  | 'lazer'
  | 'compras'
  | 'educação'
  | 'outros'

export type Transaction = {
  id: string
  type: TxType
  amount: number
  category: FinanceCategory
  note: string
  dateKey: string
  createdAt: string
}

export type SavingsGoal = {
  id: string
  name: string
  target: number
  saved: number
}

export type FinancasState = {
  transactions: Transaction[]
  goals: SavingsGoal[]
}

export type MonthStats = {
  income: number
  expense: number
  balance: number
  byCategory: { category: FinanceCategory; total: number }[]
}
