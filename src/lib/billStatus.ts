import type { BillStatus, RecurringBill } from '../types/financas'

function monthKeyFromDate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Data de pagamento. Sem data gravada, usa o dia do mês corrente. */
export function billDueDate(bill: RecurringBill, now = new Date()) {
  if (bill.payDate && ISO_DATE.test(bill.payDate)) {
    const [y, m, d] = bill.payDate.split('-').map(Number)
    const due = new Date(y, m - 1, d, 12, 0, 0, 0)
    if (
      due.getFullYear() === y &&
      due.getMonth() === m - 1 &&
      due.getDate() === d
    ) {
      return due
    }
  }
  const day = Math.min(28, Math.max(1, bill.dayOfMonth || 1))
  return new Date(now.getFullYear(), now.getMonth(), day, 12, 0, 0, 0)
}

function billCycleMonth(bill: RecurringBill, now: Date) {
  if (bill.payDate && ISO_DATE.test(bill.payDate)) return bill.payDate.slice(0, 7)
  return monthKeyFromDate(now)
}

function isBillPaid(bill: RecurringBill, now: Date) {
  if (!bill.lastPaidMonth) return false
  return bill.lastPaidMonth >= billCycleMonth(bill, now)
}

/** Dias até o vencimento (negativo = já passou). */
export function daysUntilBill(bill: RecurringBill, now = new Date()) {
  const due = billDueDate(bill, now)
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12,
    0,
    0,
    0,
  )
  return Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

export function getBillStatus(
  bill: RecurringBill,
  now = new Date(),
): BillStatus {
  if (!bill.active) return 'ok'
  if (isBillPaid(bill, now)) return 'paid'

  const delta = daysUntilBill(bill, now)
  if (delta === 0) return 'today'
  if (delta < 0) return 'overdue'
  if (delta <= 3) return 'soon'
  return 'ok'
}

export const BILL_STATUS_LABEL: Record<BillStatus, string> = {
  paid: 'Pago',
  today: 'Hoje',
  overdue: 'Atrasado',
  soon: 'Em breve',
  ok: 'Em dia',
}

/** Ordena: atrasado → hoje → em breve → resto → pago → pausado. */
export function sortBills(bills: RecurringBill[], now = new Date()) {
  const rank: Record<BillStatus, number> = {
    overdue: 0,
    today: 1,
    soon: 2,
    ok: 3,
    paid: 4,
  }
  return [...bills].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    const sa = getBillStatus(a, now)
    const sb = getBillStatus(b, now)
    if (rank[sa] !== rank[sb]) return rank[sa] - rank[sb]
    return (
      daysUntilBill(a, now) - daysUntilBill(b, now) ||
      a.name.localeCompare(b.name)
    )
  })
}

export function activeBillsTotal(bills: RecurringBill[]) {
  return bills
    .filter((b) => b.active)
    .reduce((sum, b) => sum + b.amount, 0)
}

export function overdueBills(bills: RecurringBill[], now = new Date()) {
  return bills.filter((b) => b.active && getBillStatus(b, now) === 'overdue')
}

export function dueSoonBills(bills: RecurringBill[], now = new Date()) {
  return bills.filter((b) => {
    if (!b.active) return false
    const s = getBillStatus(b, now)
    return s === 'today' || s === 'soon' || s === 'overdue'
  })
}

export function billsDueTodayOrTomorrow(
  bills: RecurringBill[],
  now = new Date(),
) {
  return bills.filter((b) => {
    if (!b.active) return false
    if (isBillPaid(b, now)) return false
    const delta = daysUntilBill(b, now)
    return delta === 0 || delta === 1
  })
}

export type BillCalendarItem = {
  bill: RecurringBill
  dateKey: string
  daysUntil: number
  status: BillStatus
}

/**
 * Próximos vencimentos (inclui atrasados deste mês e dias futuros até `horizonDays`).
 */
export function upcomingBillCalendar(
  bills: RecurringBill[],
  horizonDays = 30,
  now = new Date(),
): BillCalendarItem[] {
  const items: BillCalendarItem[] = []

  for (const bill of bills) {
    if (!bill.active) continue
    if (isBillPaid(bill, now)) continue

    const due = billDueDate(bill, now)
    const daysUntil = daysUntilBill(bill, now)
    if (daysUntil > horizonDays) continue

    const y = due.getFullYear()
    const m = String(due.getMonth() + 1).padStart(2, '0')
    const d = String(due.getDate()).padStart(2, '0')
    items.push({
      bill,
      dateKey: `${y}-${m}-${d}`,
      daysUntil,
      status: daysUntil < 0 ? 'overdue' : getBillStatus(bill, now),
    })
  }

  return items.sort(
    (a, b) =>
      a.daysUntil - b.daysUntil || a.bill.name.localeCompare(b.bill.name),
  )
}
