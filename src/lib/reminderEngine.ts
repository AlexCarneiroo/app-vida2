import { isHabitDueOn } from '../data/habitosDefaults'
import type { FinancasState } from '../types/financas'
import type { HabitosState } from '../types/habitos'
import type { NutricaoState } from '../types/nutricao'
import type { RotinaState } from '../types/rotina'
import type { TreinoState } from '../types/treino'
import { daysUntilBill, getBillStatus } from './billStatus'
import { dateKey, formatBRL } from './date'
import { GRACE_MIN, type Notice, type NotifSettings } from './notifSettings'

/**
 * Motor de lembretes — puro (sem window/localStorage). Usado no app (modo
 * local) e no servidor (push com o app fechado), com a mesma lógica.
 */

export type DataName =
  | 'treino'
  | 'habitos'
  | 'nutricao'
  | 'financas'
  | 'rotina'

export type ReminderStates = {
  treino: TreinoState
  habitos: HabitosState
  nutricao: NutricaoState
  financas: FinancasState
  rotina: RotinaState
}

/** Lê o estado de um módulo (null se não existir). */
export type ReadState = <K extends DataName>(
  name: K,
) => Partial<ReminderStates[K]> | null

export type ReminderContext = {
  /** Relógio de parede do utilizador (campos locais = hora dele). */
  now: Date
  settings: NotifSettings
  read: ReadState
}

export type DueReminder = Notice & {
  /** Chave única do aviso (tipo + dia + faixa) para não repetir */
  id: string
}

type Clock = { today: string; nowMin: number; dow: number; now: Date }

function minutesOf(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** A hora marcada já passou há no máximo GRACE_MIN minutos? */
function inWindow(nowMin: number, atMin: number) {
  const diff = nowMin - atMin
  return diff >= 0 && diff <= GRACE_MIN
}

function fmtLiters(ml: number) {
  return `${(ml / 1000).toFixed(1).replace('.', ',')} L`
}

function dueTreino(ctx: ReminderContext, c: Clock): DueReminder[] {
  const { settings: s } = ctx
  if (!s.treino.on || !inWindow(c.nowMin, minutesOf(s.treino.time))) return []
  const state = ctx.read('treino')
  const template = state?.plan?.find((t) => t.dayOfWeek === c.dow)
  if (!state || !template) return []
  if (state.weekDone?.[c.today]) return []
  if (state.active) return []
  return [
    {
      id: `treino:${c.today}`,
      tag: 'treino',
      title: 'Hora do treino 💪',
      body: template.focus
        ? `${template.name} · ${template.focus}`
        : `Hoje é dia de ${template.name}.`,
      url: '/treino',
    },
  ]
}

function dueAgua(ctx: ReminderContext, c: Clock): DueReminder[] {
  const { settings: s } = ctx
  if (!s.agua.on) return []
  const from = minutesOf(s.agua.from)
  const to = minutesOf(s.agua.to)
  if (to <= from || c.nowMin < from || c.nowMin > to + GRACE_MIN) return []

  // Faixa mais recente: from, from+N, from+2N… (sem passar do fim).
  const step = Math.max(30, s.agua.everyMin)
  const slot = Math.floor((c.nowMin - from) / step)
  const slotMin = from + slot * step
  if (slotMin > to || !inWindow(c.nowMin, slotMin)) return []

  const state = ctx.read('nutricao')
  const goal = Number(state?.waterGoal) || 0
  const drank = Number(state?.waterByDay?.[c.today]) || 0
  if (goal <= 0 || drank >= goal) return []

  const left = goal - drank
  const pct = Math.round((drank / goal) * 100)
  return [
    {
      id: `agua:${c.today}:${slot}`,
      tag: 'agua',
      title: 'Hora de beber água 💧',
      body: `Faltam ${fmtLiters(left)} para a meta de hoje (${pct}% feito).`,
      url: '/nutricao',
    },
  ]
}

function dueHabitos(ctx: ReminderContext, c: Clock): DueReminder[] {
  const { settings: s } = ctx
  if (!s.habitos.on) return []
  const habits = ctx.read('habitos')?.habits ?? []
  if (habits.length === 0) return []

  const pending = habits.filter(
    (h) =>
      isHabitDueOn(h, c.today) &&
      h.lastDoneDateKey !== c.today &&
      h.lastSkipDateKey !== c.today,
  )
  const out: DueReminder[] = []

  for (const h of pending) {
    if (!h.reminderEnabled || !h.reminderTime) continue
    if (!inWindow(c.nowMin, minutesOf(h.reminderTime))) continue
    out.push({
      id: `habito:${h.id}:${c.today}`,
      tag: `habito-${h.id}`,
      title: `Hábito: ${h.name}`,
      body:
        h.streak > 0
          ? `Sequência de ${h.streak} ${h.streak === 1 ? 'dia' : 'dias'} — não deixe quebrar.`
          : h.detail || 'Hora de fazer o seu hábito.',
      url: '/habitos',
    })
  }

  if (s.habitos.streakGuard && inWindow(c.nowMin, minutesOf('20:00'))) {
    const risk = pending
      .filter((h) => h.streak >= 3)
      .sort((a, b) => b.streak - a.streak)
    if (risk.length > 0) {
      const top = risk[0]
      out.push({
        id: `streak:${c.today}`,
        tag: 'streak',
        title: 'Proteja a sua sequência 🔥',
        body:
          risk.length === 1
            ? `“${top.name}” está há ${top.streak} dias seguidos e ainda não foi feito hoje.`
            : `${risk.length} hábitos com sequência em risco — o maior: “${top.name}” (${top.streak} dias).`,
        url: '/habitos',
      })
    }
  }

  return out
}

function dueRotina(ctx: ReminderContext, c: Clock): DueReminder[] {
  if (!ctx.settings.rotina.on) return []
  const state = ctx.read('rotina')
  const sameDay = state?.dayKey === c.today
  const out: DueReminder[] = []
  for (const block of state?.blocks ?? []) {
    if (!/^\d{2}:\d{2}$/.test(block.time)) continue
    if (sameDay && block.doneToday) continue
    if (!inWindow(c.nowMin, minutesOf(block.time))) continue
    out.push({
      id: `rotina:${block.id}:${c.today}`,
      tag: `rotina-${block.id}`,
      title: block.title || 'Rotina',
      body: block.detail || `Bloco das ${block.time}.`,
      url: '/rotina',
    })
  }
  return out
}

function dueContas(ctx: ReminderContext, c: Clock): DueReminder[] {
  const { settings: s } = ctx
  if (!s.contas.on || !inWindow(c.nowMin, minutesOf(s.contas.time))) return []
  const items = (ctx.read('financas')?.bills ?? [])
    .filter((b) => b.active)
    .map((bill) => ({
      bill,
      status: getBillStatus(bill, c.now),
      days: daysUntilBill(bill, c.now),
    }))
    .filter(
      (i) =>
        i.status === 'overdue' ||
        i.status === 'today' ||
        (i.status === 'soon' && i.days === 1),
    )
    .sort((a, b) => a.days - b.days)
  if (items.length === 0) return []

  const label = (i: (typeof items)[number]) =>
    i.status === 'overdue'
      ? `${i.bill.name} (atrasada)`
      : i.days === 0
        ? `${i.bill.name} (hoje)`
        : `${i.bill.name} (amanhã)`
  const total = items.reduce((sum, i) => sum + i.bill.amount, 0)
  const shown = items.slice(0, 3).map(label).join(' · ')
  const extra = items.length > 3 ? ` +${items.length - 3}` : ''

  return [
    {
      id: `contas:${c.today}`,
      tag: 'contas',
      title:
        items.length === 1
          ? 'Conta a vencer 💸'
          : `${items.length} contas a vencer 💸`,
      body: `${shown}${extra} — total ${formatBRL(total)}`,
      url: '/financas',
    },
  ]
}

function dueSono(ctx: ReminderContext, c: Clock): DueReminder[] {
  const { settings: s } = ctx
  if (!s.sono.on || !inWindow(c.nowMin, minutesOf(s.sono.time))) return []
  return [
    {
      id: `sono:${c.today}`,
      tag: 'sono',
      title: 'Hora de desacelerar 🌙',
      body: 'Largue o ecrã e prepare-se para dormir bem.',
      url: '/saude',
    },
  ]
}

function dueResumo(ctx: ReminderContext, c: Clock): DueReminder[] {
  const { settings: s } = ctx
  if (!s.resumo.on || !inWindow(c.nowMin, minutesOf(s.resumo.time))) return []

  const parts: string[] = []

  const treino = ctx.read('treino')
  if (treino?.plan?.some((t) => t.dayOfWeek === c.dow)) {
    parts.push(treino.weekDone?.[c.today] ? 'Treino ✓' : 'Treino pendente')
  }

  const nutri = ctx.read('nutricao')
  const goal = Number(nutri?.waterGoal) || 0
  if (goal > 0) {
    const drank = Number(nutri?.waterByDay?.[c.today]) || 0
    parts.push(`Água ${fmtLiters(drank)}/${fmtLiters(goal)}`)
  }

  const due = (ctx.read('habitos')?.habits ?? []).filter((h) =>
    isHabitDueOn(h, c.today),
  )
  if (due.length > 0) {
    const done = due.filter((h) => h.lastDoneDateKey === c.today).length
    parts.push(`Hábitos ${done}/${due.length}`)
  }

  if (parts.length === 0) return []
  return [
    {
      id: `resumo:${c.today}`,
      tag: 'resumo',
      title: 'Resumo do seu dia 📊',
      body: parts.join(' · '),
      url: '/',
    },
  ]
}

/** Tudo o que deve ser avisado neste instante (ainda por filtrar repetidos). */
export function collectDueReminders(ctx: ReminderContext): DueReminder[] {
  if (!ctx.settings.enabled) return []
  const clock: Clock = {
    today: dateKey(ctx.now),
    nowMin: ctx.now.getHours() * 60 + ctx.now.getMinutes(),
    dow: ctx.now.getDay(),
    now: ctx.now,
  }
  return [
    ...dueTreino(ctx, clock),
    ...dueAgua(ctx, clock),
    ...dueHabitos(ctx, clock),
    ...dueRotina(ctx, clock),
    ...dueContas(ctx, clock),
    ...dueSono(ctx, clock),
    ...dueResumo(ctx, clock),
  ]
}
