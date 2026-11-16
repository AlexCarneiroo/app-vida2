export type ShoppingAisle =
  | 'mercearia'
  | 'frescos'
  | 'limpeza'
  | 'outros'

/** Captura rápida do que falta — antes de entrar na lista. */
export type NeededItem = {
  id: string
  name: string
  note?: string
  createdAt: string
}

export type ShoppingItem = {
  id: string
  name: string
  qty?: number
  unit?: string
  checked: boolean
  estimatedPrice?: number
  aisle: ShoppingAisle
  fromNeededId?: string
  createdAt: string
}

export type ShoppingListStatus = 'active' | 'done'

export type ShoppingList = {
  id: string
  title: string
  status: ShoppingListStatus
  items: ShoppingItem[]
  createdAt: string
  completedAt?: string | null
  financeTxId?: string | null
  totalSpent?: number | null
  financeCategory?: 'alimentação' | 'compras' | null
}

export type ComprasState = {
  needed: NeededItem[]
  lists: ShoppingList[]
  activeListId: string | null
  /** Memória de secções escolhidas pelo utilizador (nome normalizado → aisle) */
  aisleMemory: Record<string, ShoppingAisle>
}
