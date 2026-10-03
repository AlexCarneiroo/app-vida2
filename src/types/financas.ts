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

/** Assinatura / conta fixa mensal (Netflix, academia, luz…). */
export type RecurringBill = {
  id: string
  name: string
  amount: number
  /** Dia do mês 1–28 */
  dayOfMonth: number
  category: FinanceCategory
  active: boolean
  /** YYYY-MM do último pagamento registado */
  lastPaidMonth: string | null
  createdAt: string
}

export type BillStatus = 'paid' | 'today' | 'overdue' | 'soon' | 'ok'

/** Teto mensal de gasto por categoria (envelope). */
export type CategoryBudget = {
  id: string
  category: FinanceCategory
  limit: number
}

export type FinancasState = {
  transactions: Transaction[]
  goals: SavingsGoal[]
  bills: RecurringBill[]
  budgets: CategoryBudget[]
}

export type MonthStats = {
  income: number
  expense: number
  balance: number
  byCategory: { category: FinanceCategory; total: number }[]
}
