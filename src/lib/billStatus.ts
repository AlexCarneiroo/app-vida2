import type { BillStatus, RecurringBill } from '../types/financas'

function monthKeyFromDate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** Dias até o vencimento neste mês (negativo = já passou). */
export function daysUntilBill(bill: RecurringBill, now = new Date()) {
  const today = now.getDate()
  return bill.dayOfMonth - today
}

export function getBillStatus(
  bill: RecurringBill,
  now = new Date(),
): BillStatus {
  if (!bill.active) return 'ok'
  const month = monthKeyFromDate(now)
  if (bill.lastPaidMonth === month) return 'paid'

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
    return a.dayOfMonth - b.dayOfMonth || a.name.localeCompare(b.name)
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
    const month = monthKeyFromDate(now)
    if (b.lastPaidMonth === month) return false
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
  const month = monthKeyFromDate(now)
  const y = now.getFullYear()
  const m = now.getMonth()
  const items: BillCalendarItem[] = []

  for (const bill of bills) {
    if (!bill.active) continue
    const paid = bill.lastPaidMonth === month
    const day = bill.dayOfMonth
    const due = new Date(y, m, day)
    due.setHours(12, 0, 0, 0)
    const todayNoon = new Date(y, m, now.getDate(), 12, 0, 0, 0)
    let daysUntil = Math.round(
      (due.getTime() - todayNoon.getTime()) / (24 * 60 * 60 * 1000),
    )

    // Se já passou e não pago: atrasado (daysUntil negativo)
    // Se pago e já passou: pula
    if (paid && daysUntil <= 0) continue
    if (paid && daysUntil > horizonDays) continue

    // Se ainda não pago e o dia já passou: incluir como atrasado
    if (!paid && daysUntil < 0) {
      items.push({
        bill,
        dateKey: `${month}-${String(day).padStart(2, '0')}`,
        daysUntil,
        status: 'overdue',
      })
      continue
    }

    if (daysUntil > horizonDays) continue
    if (paid) continue

    items.push({
      bill,
      dateKey: `${month}-${String(day).padStart(2, '0')}`,
      daysUntil,
      status: getBillStatus(bill, now),
    })
  }

  return items.sort(
    (a, b) =>
      a.daysUntil - b.daysUntil || a.bill.name.localeCompare(b.bill.name),
  )
}
