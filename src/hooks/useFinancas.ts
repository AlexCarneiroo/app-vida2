import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  clampBillDay,
  emptyFinancasState,
  normalizeBill,
  normalizeBudget,
  type BillInput,
} from '../data/financasDefaults'
import {
  activeBillsTotal,
  billsDueTodayOrTomorrow,
  getBillStatus,
  overdueBills,
  sortBills,
  upcomingBillCalendar,
} from '../lib/billStatus'
import { dateKey } from '../lib/date'
import {
  flushCloudSave,
  hydrateFromCloud,
  scheduleCloudSave,
} from '../lib/cloudSync'
import { loadFinancasPersisted, touchPersisted } from '../lib/persist'
import { uid as makeId } from '../lib/storage'
import { useAuth } from './useAuth'
import type {
  FinanceCategory,
  FinancasState,
  MonthStats,
  RecurringBill,
  SavingsGoal,
  Transaction,
  TxType,
} from '../types/financas'

export type BudgetProgress = {
  id: string
  category: FinanceCategory
  limit: number
  spent: number
  pct: number
  remaining: number
}

const STORAGE_KEY = 'vida.financas.v1'

function monthPrefix(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function useFinancas() {
  const { uid, ready: authReady } = useAuth()
  const [state, setState] = useState<FinancasState>(() =>
    typeof window === 'undefined'
      ? emptyFinancasState
      : loadFinancasPersisted(STORAGE_KEY, emptyFinancasState).data,
  )
  const [monthKey, setMonthKey] = useState(() => monthPrefix())
  const hydratedRef = useRef(false)
  const stateRef = useRef(state)
  const updatedAtRef = useRef(
    typeof window === 'undefined'
      ? 0
      : loadFinancasPersisted(STORAGE_KEY, emptyFinancasState).updatedAt,
  )
  stateRef.current = state

  useEffect(() => {
    if (!authReady) return
    let cancelled = false
    hydratedRef.current = false
    ;(async () => {
      const localAtStart = loadFinancasPersisted(STORAGE_KEY, emptyFinancasState)
      const next = await hydrateFromCloud(
        'financas',
        localAtStart,
        (d) =>
          d.transactions.length === 0 &&
          d.goals.length === 0 &&
          (d.bills?.length ?? 0) === 0 &&
          (d.budgets?.length ?? 0) === 0,
      )
      if (cancelled) return
      const latestLocal = loadFinancasPersisted(STORAGE_KEY, emptyFinancasState)
      let finalDoc = next
      if (
        latestLocal.updatedAt > localAtStart.updatedAt &&
        latestLocal.updatedAt >= next.updatedAt
      ) {
        finalDoc = await hydrateFromCloud(
          'financas',
          latestLocal,
          (d) =>
            d.transactions.length === 0 &&
            d.goals.length === 0 &&
            (d.bills?.length ?? 0) === 0 &&
            (d.budgets?.length ?? 0) === 0,
        )
      }
      if (cancelled) return
      setState(finalDoc.data)
      updatedAtRef.current = finalDoc.updatedAt
      touchPersisted(STORAGE_KEY, finalDoc.data, finalDoc.updatedAt)
      hydratedRef.current = true
    })()
    return () => {
      cancelled = true
    }
  }, [uid, authReady])

  useEffect(() => {
    const at = Date.now()
    updatedAtRef.current = at
    touchPersisted(STORAGE_KEY, state, at)
    if (hydratedRef.current) scheduleCloudSave('financas', state, at)
  }, [state])

  useEffect(() => {
    const flush = () => {
      const at = updatedAtRef.current || Date.now()
      touchPersisted(STORAGE_KEY, stateRef.current, at)
      if (!hydratedRef.current) return
      void flushCloudSave('financas', stateRef.current, at)
    }
    const onOnline = () => {
      window.setTimeout(flush, 400)
    }
    window.addEventListener('pagehide', flush)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  const monthTransactions = useMemo(
    () =>
      state.transactions
        .filter((t) => t.dateKey.startsWith(monthKey))
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.createdAt.localeCompare(a.createdAt)),
    [state.transactions, monthKey],
  )

  const stats: MonthStats = useMemo(() => {
    let income = 0
    let expense = 0
    const map = new Map<FinanceCategory, number>()

    for (const t of monthTransactions) {
      if (t.type === 'income') income += t.amount
      else expense += t.amount

      if (t.type === 'expense') {
        map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
      }
    }

    const byCategory = [...map.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)

    return {
      income,
      expense,
      balance: income - expense,
      byCategory,
    }
  }, [monthTransactions])

  const addTransaction = useCallback(
    (input: {
      type: TxType
      amount: number
      category: FinanceCategory
      note?: string
      dateKey?: string
    }) => {
      const amount = Math.abs(Number(input.amount) || 0)
      if (amount <= 0) return

      const tx: Transaction = {
        id: makeId('tx'),
        type: input.type,
        amount,
        category: input.category,
        note: input.note?.trim() ?? '',
        dateKey: input.dateKey || dateKey(),
        createdAt: new Date().toISOString(),
      }

      setState((prev) => ({
        ...prev,
        transactions: [tx, ...prev.transactions].slice(0, 500),
      }))
    },
    [],
  )

  const removeTransaction = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }))
  }, [])

  const importTransactions = useCallback(
    (
      items: Array<{
        type: TxType
        amount: number
        category: FinanceCategory
        note: string
        dateKey: string
      }>,
    ) => {
      if (items.length === 0) return 0
      const now = new Date().toISOString()
      const created: Transaction[] = items
        .filter((i) => i.amount > 0)
        .map((i) => ({
          id: makeId('tx'),
          type: i.type,
          amount: Math.abs(i.amount),
          category: i.category,
          note: i.note.trim(),
          dateKey: i.dateKey,
          createdAt: now,
        }))

      setState((prev) => ({
        ...prev,
        transactions: [...created, ...prev.transactions].slice(0, 2000),
      }))

      if (created[0]) {
        setMonthKey(created[0].dateKey.slice(0, 7))
      }
      return created.length
    },
    [],
  )

  const setMonth = useCallback((key: string) => {
    if (/^\d{4}-\d{2}$/.test(key)) setMonthKey(key)
  }, [])

  const addGoal = useCallback((name: string, target: number) => {
    const goal: SavingsGoal = {
      id: makeId('goal'),
      name: name.trim() || 'Nova meta',
      target: Math.max(1, target),
      saved: 0,
    }
    setState((prev) => ({ ...prev, goals: [...prev.goals, goal] }))
  }, [])

  const updateGoalSaved = useCallback((id: string, saved: number) => {
    setState((prev) => ({
      ...prev,
      goals: prev.goals.map((g) =>
        g.id === id ? { ...g, saved: Math.max(0, saved) } : g,
      ),
    }))
  }, [])

  const removeGoal = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      goals: prev.goals.filter((g) => g.id !== id),
    }))
  }, [])

  const addBill = useCallback((input: BillInput) => {
    const bill = normalizeBill({
      id: makeId('bill'),
      name: input.name,
      amount: input.amount,
      dayOfMonth: clampBillDay(input.dayOfMonth),
      category: input.category,
      active: input.active !== false,
      lastPaidMonth: null,
      createdAt: new Date().toISOString(),
    })
    setState((prev) => ({
      ...prev,
      bills: [...(prev.bills ?? []), bill],
    }))
    return bill.id
  }, [])

  const updateBill = useCallback(
    (id: string, patch: Partial<BillInput> & { active?: boolean }) => {
      setState((prev) => ({
        ...prev,
        bills: (prev.bills ?? []).map((b) => {
          if (b.id !== id) return b
          return normalizeBill({
            ...b,
            ...patch,
            dayOfMonth:
              patch.dayOfMonth != null
                ? clampBillDay(patch.dayOfMonth)
                : b.dayOfMonth,
          })
        }),
      }))
    },
    [],
  )

  const removeBill = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      bills: (prev.bills ?? []).filter((b) => b.id !== id),
    }))
  }, [])

  /** Marca pago este mês e cria movimento de saída. */
  const markBillPaid = useCallback((id: string) => {
    let paid: RecurringBill | null = null
    setState((prev) => {
      const bill = (prev.bills ?? []).find((b) => b.id === id)
      if (!bill || !bill.active) return prev
      paid = bill
      const month = monthPrefix()
      const today = dateKey()
      const day = String(bill.dayOfMonth).padStart(2, '0')
      const renewKey = `${month}-${day}`
      // Usa o dia da renovação se ainda não passou; senão hoje
      const payDate = renewKey <= today ? today : renewKey

      const tx: Transaction = {
        id: makeId('tx'),
        type: 'expense',
        amount: bill.amount,
        category: bill.category,
        note: bill.name,
        dateKey: payDate,
        createdAt: new Date().toISOString(),
      }

      return {
        ...prev,
        bills: (prev.bills ?? []).map((b) =>
          b.id === id ? { ...b, lastPaidMonth: month } : b,
        ),
        transactions: [tx, ...prev.transactions].slice(0, 500),
      }
    })
    return paid
  }, [])

  const bills = useMemo(
    () => sortBills(state.bills ?? []),
    [state.bills],
  )

  const billsMonthlyTotal = useMemo(
    () => activeBillsTotal(state.bills ?? []),
    [state.bills],
  )

  const billsOverdue = useMemo(
    () => overdueBills(state.bills ?? []),
    [state.bills],
  )

  const billsDueSoonAlert = useMemo(
    () => billsDueTodayOrTomorrow(state.bills ?? []),
    [state.bills],
  )

  const billsCalendar7 = useMemo(
    () => upcomingBillCalendar(state.bills ?? [], 7),
    [state.bills],
  )

  const billsCalendar30 = useMemo(
    () => upcomingBillCalendar(state.bills ?? [], 30),
    [state.bills],
  )

  const upsertBudget = useCallback(
    (category: FinanceCategory, limit: number) => {
      const clean = Math.max(1, limit)
      setState((prev) => {
        const list = prev.budgets ?? []
        const existing = list.find((b) => b.category === category)
        if (existing) {
          return {
            ...prev,
            budgets: list.map((b) =>
              b.category === category
                ? normalizeBudget({ ...b, limit: clean })
                : b,
            ),
          }
        }
        return {
          ...prev,
          budgets: [
            ...list,
            normalizeBudget({
              id: makeId('budget'),
              category,
              limit: clean,
            }),
          ],
        }
      })
    },
    [],
  )

  const removeBudget = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      budgets: (prev.budgets ?? []).filter((b) => b.id !== id),
    }))
  }, [])

  const budgetProgress: BudgetProgress[] = useMemo(() => {
    const spentMap = new Map<FinanceCategory, number>()
    for (const t of monthTransactions) {
      if (t.type !== 'expense') continue
      spentMap.set(t.category, (spentMap.get(t.category) ?? 0) + t.amount)
    }
    return (state.budgets ?? [])
      .map((b) => {
        const spent = spentMap.get(b.category) ?? 0
        const pct = Math.min(999, Math.round((spent / b.limit) * 100))
        return {
          id: b.id,
          category: b.category,
          limit: b.limit,
          spent,
          pct,
          remaining: Math.max(0, b.limit - spent),
        }
      })
      .sort((a, b) => b.pct - a.pct)
  }, [state.budgets, monthTransactions])

  const shiftMonth = useCallback((delta: number) => {
    setMonthKey((prev) => {
      const [y, m] = prev.split('-').map(Number)
      const d = new Date(y, m - 1 + delta, 1)
      return monthPrefix(d)
    })
  }, [])

  const monthLabel = useMemo(() => {
    const [y, m] = monthKey.split('-').map(Number)
    const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }, [monthKey])

  return {
    state,
    monthKey,
    monthLabel,
    monthTransactions,
    stats,
    bills,
    billsMonthlyTotal,
    billsOverdue,
    billsDueSoonAlert,
    billsCalendar7,
    billsCalendar30,
    budgetProgress,
    getBillStatus,
    addTransaction,
    removeTransaction,
    importTransactions,
    setMonth,
    addGoal,
    updateGoalSaved,
    removeGoal,
    addBill,
    updateBill,
    removeBill,
    markBillPaid,
    upsertBudget,
    removeBudget,
    shiftMonth,
  }
}
