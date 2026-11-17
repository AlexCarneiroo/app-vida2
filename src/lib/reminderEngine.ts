import { isHabitDueOn } from '../data/habitosDefaults'
import { pendingCount } from '../data/comprasDefaults'
import type { ComprasState } from '../types/compras'
import type { FinancasState } from '../types/financas'
import type { HabitosState } from '../types/habitos'
import type { NutricaoState } from '../types/nutricao'
import type { RotinaState } from '../types/rotina'
import type { TreinoState } from '../types/treino'
import { daysUntilBill, getBillStatus } from './billStatus'
import { dateKey, formatBRL, startOfWeek } from './date'
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
  | 'compras'

export type ReminderStates = {
  treino: TreinoState
  habitos: HabitosState
  nutricao: NutricaoState
  financas: FinancasState
  rotina: RotinaState
  compras: ComprasState
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
  const byDay =
    state?.waterByDay && typeof state.waterByDay === 'object'
      ? state.waterByDay
      : {}
  const drank = Math.max(0, Number(byDay[c.today]) || 0)
  if (goal <= 0 || drank >= goal) return []

  const left = goal - drank
  const pct = Math.round((drank / goal) * 100)
  const body =
    drank <= 0
      ? `Ainda sem registo hoje. Meta ${fmtLiters(goal)} — começa com um gole.`
      : `Já bebeste ${fmtLiters(drank)} (${pct}%). Faltam ${fmtLiters(left)} para a meta.`
  return [
    {
      id: `agua:${c.today}:${slot}`,
      tag: 'agua',
      title: 'Hora de beber água 💧',
      body,
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
      !h.doneToday &&
      !h.skippedToday &&
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

function dueCompras(ctx: ReminderContext, c: Clock): DueReminder[] {
  const { settings: s } = ctx
  if (!s.compras.on || !inWindow(c.nowMin, minutesOf(s.compras.time))) return []
  const state = ctx.read('compras')
  if (!state) return []
  const active =
    state.lists?.find((l) => l.id === state.activeListId) ??
    state.lists?.find((l) => l.status === 'active')
  const pending = pendingCount(active)
  const needed = state.needed?.length ?? 0
  if (pending <= 0 && needed <= 0) return []
  const parts: string[] = []
  if (pending > 0) {
    parts.push(
      pending === 1 ? '1 item por comprar' : `${pending} itens por comprar`,
    )
  }
  if (needed > 0) {
    parts.push(
      needed === 1 ? '1 marcado em Falta' : `${needed} marcados em Falta`,
    )
  }
  return [
    {
      id: `compras:${c.today}`,
      tag: 'compras',
      title: 'Lista de compras 🛒',
      body: parts.join(' · '),
      url: '/compras',
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
    const byDay =
      nutri?.waterByDay && typeof nutri.waterByDay === 'object'
        ? nutri.waterByDay
        : {}
    const drank = Math.max(0, Number(byDay[c.today]) || 0)
    parts.push(`Água ${fmtLiters(drank)}/${fmtLiters(goal)}`)
  }

  const due = (ctx.read('habitos')?.habits ?? []).filter((h) =>
    isHabitDueOn(h, c.today),
  )
  if (due.length > 0) {
    const done = due.filter(
      (h) =>
        h.doneToday ||
        h.skippedToday ||
        h.lastDoneDateKey === c.today ||
        h.lastSkipDateKey === c.today,
    ).length
    parts.push(`Hábitos ${done}/${due.length}`)
  }

  const rotina = ctx.read('rotina')
  const blocks = rotina?.blocks ?? []
  if (blocks.length > 0) {
    const done =
      rotina?.dayKey === c.today
        ? blocks.filter((b) => b.doneToday).length
        : 0
    parts.push(`Rotina ${done}/${blocks.length}`)
  }

  const compras = ctx.read('compras')
  if (compras) {
    const active =
      compras.lists?.find((l) => l.id === compras.activeListId) ??
      compras.lists?.find((l) => l.status === 'active')
    const pending = pendingCount(active)
    if (pending > 0) parts.push(`Compras ${pending} pendentes`)
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

function dueResumoSemanal(ctx: ReminderContext, c: Clock): DueReminder[] {
  const { settings: s } = ctx
  const cfg = s.resumoSemanal
  if (!cfg?.on) return []
  if (c.dow !== cfg.weekday) return []
  if (!inWindow(c.nowMin, minutesOf(cfg.time))) return []

  const weekStart = dateKey(startOfWeek(c.now))
  const weekEnd = c.today
  const parts: string[] = []

  const treino = ctx.read('treino')
  if (treino?.history) {
    const sessions = treino.history.filter(
      (w) =>
        w.completedAt &&
        w.dateKey >= weekStart &&
        w.dateKey <= weekEnd,
    )
    if (sessions.length > 0) {
      parts.push(
        sessions.length === 1
          ? '1 treino'
          : `${sessions.length} treinos`,
      )
    }
  }

  const habitsLog = ctx.read('habitos')?.dayLog
  if (habitsLog && typeof habitsLog === 'object') {
    let total = 0
    for (const [key, value] of Object.entries(habitsLog)) {
      if (key >= weekStart && key <= weekEnd) total += Number(value) || 0
    }
    if (total > 0) parts.push(`${total} hábitos`)
  }

  const nutri = ctx.read('nutricao')
  const waterGoal = Number(nutri?.waterGoal) || 0
  if (waterGoal > 0 && nutri?.waterByDay) {
    let daysOk = 0
    for (const [key, value] of Object.entries(nutri.waterByDay)) {
      if (key < weekStart || key > weekEnd) continue
      if (Number(value) >= waterGoal * 0.9) daysOk += 1
    }
    if (daysOk > 0) parts.push(`Água ${daysOk}d ok`)
  }

  const finance = ctx.read('financas')
  if (finance?.transactions) {
    let expense = 0
    for (const t of finance.transactions) {
      if (t.dateKey < weekStart || t.dateKey > weekEnd) continue
      if (t.type === 'expense') expense += t.amount
    }
    if (expense > 0) parts.push(`−${formatBRL(expense)}`)
  }

  const compras = ctx.read('compras')
  if (compras) {
    const done = (compras.lists ?? []).filter(
      (l) =>
        l.status === 'done' &&
        l.completedAt &&
        l.completedAt.slice(0, 10) >= weekStart &&
        l.completedAt.slice(0, 10) <= weekEnd,
    ).length
    if (done > 0) {
      parts.push(done === 1 ? '1 lista concluída' : `${done} listas`)
    }
  }

  if (parts.length === 0) {
    parts.push('Abre o relatório para rever a semana')
  }

  return [
    {
      id: `resumoSemanal:${weekStart}`,
      tag: 'resumoSemanal',
      title: 'A tua semana 📊',
      body: parts.join(' · '),
      url: '/relatorio?range=week',
    },
  ]
}

function clockFrom(now: Date): Clock {
  return {
    today: dateKey(now),
    nowMin: now.getHours() * 60 + now.getMinutes(),
    dow: now.getDay(),
    now,
  }
}

/**
 * Cartões de progresso para a central (sempre com dados atuais).
 * Não disparam push — só atualizam o texto que o utilizador vê.
 */
export function collectLiveStatusNotices(ctx: ReminderContext): DueReminder[] {
  if (!ctx.settings.enabled) return []
  const c = clockFrom(ctx.now)
  const out: DueReminder[] = []

  const nutri = ctx.read('nutricao')
  const waterGoal = Number(nutri?.waterGoal) || 0
  if (waterGoal > 0) {
    const byDay =
      nutri?.waterByDay && typeof nutri.waterByDay === 'object'
        ? nutri.waterByDay
        : {}
    const drank = Math.max(0, Number(byDay[c.today]) || 0)
    const pct = Math.min(100, Math.round((drank / waterGoal) * 100))
    out.push({
      id: `live:agua:${c.today}`,
      tag: 'live-agua',
      title: 'Água hoje',
      body:
        drank <= 0
          ? `0 / ${fmtLiters(waterGoal)} — ainda sem registo`
          : drank >= waterGoal
            ? `${fmtLiters(drank)} / ${fmtLiters(waterGoal)} · meta feita ✓`
            : `${fmtLiters(drank)} / ${fmtLiters(waterGoal)} · ${pct}%`,
      url: '/nutricao',
    })
  }

  const habits = ctx.read('habitos')?.habits ?? []
  const dueHabits = habits.filter((h) => isHabitDueOn(h, c.today))
  if (dueHabits.length > 0) {
    const done = dueHabits.filter(
      (h) =>
        h.doneToday ||
        h.skippedToday ||
        h.lastDoneDateKey === c.today ||
        h.lastSkipDateKey === c.today,
    ).length
    out.push({
      id: `live:habitos:${c.today}`,
      tag: 'live-habitos',
      title: 'Hábitos hoje',
      body: `${done}/${dueHabits.length} concluídos`,
      url: '/habitos',
    })
  }

  const treino = ctx.read('treino')
  const template = treino?.plan?.find((t) => t.dayOfWeek === c.dow)
  if (template) {
    const done = Boolean(treino?.weekDone?.[c.today])
    out.push({
      id: `live:treino:${c.today}`,
      tag: 'live-treino',
      title: 'Treino hoje',
      body: done
        ? `${template.name} · concluído ✓`
        : treino?.active
          ? `${template.name} · em andamento`
          : `${template.name} · por fazer`,
      url: '/treino',
    })
  }

  const rotina = ctx.read('rotina')
  const blocks = rotina?.blocks ?? []
  if (blocks.length > 0) {
    const sameDay = rotina?.dayKey === c.today
    const done = sameDay ? blocks.filter((b) => b.doneToday).length : 0
    out.push({
      id: `live:rotina:${c.today}`,
      tag: 'live-rotina',
      title: 'Rotina hoje',
      body: `${done}/${blocks.length} blocos`,
      url: '/rotina',
    })
  }

  const compras = ctx.read('compras')
  if (compras) {
    const active =
      compras.lists?.find((l) => l.id === compras.activeListId) ??
      compras.lists?.find((l) => l.status === 'active')
    const pending = pendingCount(active)
    const needed = compras.needed?.length ?? 0
    if (pending > 0 || needed > 0) {
      out.push({
        id: `live:compras:${c.today}`,
        tag: 'live-compras',
        title: 'Compras',
        body: [
          pending > 0 ? `${pending} na lista` : null,
          needed > 0 ? `${needed} em Falta` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        url: '/compras',
      })
    }
  }

  return out
}

/** Tudo o que deve ser avisado neste instante (ainda por filtrar repetidos). */
export function collectDueReminders(ctx: ReminderContext): DueReminder[] {
  if (!ctx.settings.enabled) return []
  const clock = clockFrom(ctx.now)
  return [
    ...dueTreino(ctx, clock),
    ...dueAgua(ctx, clock),
    ...dueHabitos(ctx, clock),
    ...dueRotina(ctx, clock),
    ...dueContas(ctx, clock),
    ...dueCompras(ctx, clock),
    ...dueSono(ctx, clock),
    ...dueResumo(ctx, clock),
    ...dueResumoSemanal(ctx, clock),
  ]
}
