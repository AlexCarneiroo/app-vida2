import { dateKey, uid } from '../lib/date'
import type {
  ComprasState,
  NeededItem,
  ShoppingAisle,
  ShoppingItem,
  ShoppingList,
} from '../types/compras'

export const SHOPPING_AISLES: { id: ShoppingAisle; label: string }[] = [
  { id: 'mercearia', label: 'Mercearia' },
  { id: 'frescos', label: 'Frescos' },
  { id: 'limpeza', label: 'Limpeza' },
  { id: 'outros', label: 'Outros' },
]

function stripAccents(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '')
}

function normalizeProductKey(name: string) {
  return stripAccents(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Palavras-chave → secção (ordem = prioridade). */
const AISLE_KEYWORDS: { aisle: ShoppingAisle; words: string[] }[] = [
  {
    aisle: 'limpeza',
    words: [
      'detergente',
      'amaciante',
      'sabao',
      'sabão',
      'multiuso',
      'desinfetante',
      'alvejante',
      'agua sanitaria',
      'água sanitária',
      'limpeza',
      'esponja',
      'vassoura',
      'rodo',
      'pano',
      'papel higienico',
      'papel toalha',
      'saco lixo',
      'lixo',
      'shampoo',
      'condicionador',
      'sabonete',
      'pasta dente',
      'creme dental',
      'fio dental',
      'desodorante',
      'absorvente',
      'fralda',
      'lenço',
      'lenco',
      'alcool',
      'álcool',
      'lava louca',
      'lava-loucas',
      'limpador',
    ],
  },
  {
    aisle: 'frescos',
    words: [
      'banana',
      'maca',
      'maçã',
      'morango',
      'uva',
      'laranja',
      'limao',
      'limão',
      'abacaxi',
      'mamao',
      'mamão',
      'manga',
      'melancia',
      'melao',
      'melão',
      'pera',
      'kiwi',
      'coco',
      'abacate',
      'tomate',
      'alface',
      'cebola',
      'alho',
      'batata',
      'cenoura',
      'brocolis',
      'brócolis',
      'couve',
      'espinafre',
      'pepino',
      'abobrinha',
      'berinjela',
      'pimentao',
      'pimentão',
      'rucula',
      'rúcula',
      'hortela',
      'hortelã',
      'salsa',
      'coentro',
      'fruta',
      'legume',
      'verdura',
      'salada',
      'carne',
      'frango',
      'peito',
      'coxinha asa',
      'bife',
      'carne moida',
      'carne moída',
      'costela',
      'linguica',
      'linguiça',
      'salsicha',
      'bacon',
      'presunto',
      'peito peru',
      'peixe',
      'salmao',
      'salmão',
      'tilapia',
      'tilápia',
      'camarao',
      'camarão',
      'atum fresco',
      'leite',
      'iogurte',
      'queijo',
      'mussarela',
      'mozzarella',
      'requeijao',
      'requeijão',
      'manteiga',
      'margarina',
      'creme de leite',
      'nata',
      'ovos',
      'ovo',
      'pao',
      'pão',
      'paozinho',
      'pãozinho',
      'baguete',
      'baguette',
      'tapioca',
      'coalho',
    ],
  },
  {
    aisle: 'mercearia',
    words: [
      'arroz',
      'feijao',
      'feijão',
      'macarrao',
      'macarrão',
      'massa',
      'farinha',
      'acucar',
      'açúcar',
      'sal',
      'oleo',
      'óleo',
      'azeite',
      'vinagre',
      'molho',
      'ketchup',
      'maionese',
      'mostarda',
      'cafe',
      'café',
      'cha',
      'chá',
      'achocolatado',
      'leite em po',
      'leite em pó',
      'cereal',
      'aveia',
      'granola',
      'biscoito',
      'bolacha',
      'cookie',
      'chocolate',
      'doce',
      'geleia',
      'mel',
      'enlatado',
      'milho',
      'ervilha',
      'atum',
      'sardinha',
      'conserva',
      'tempero',
      'pimenta',
      'oregano',
      'orégano',
      'fermento',
      'fermento',
      'refrigerante',
      'suco',
      'agua',
      'água',
      'cerveja',
      'vinho',
      'energetico',
      'energético',
      'congelado',
      'sorvete',
      'pizza',
      'nugget',
      'batata frita',
      'miojo',
      'instantaneo',
      'instantâneo',
      'catchup',
      'shoyu',
      'soja',
      'grao',
      'grão',
      'lentilha',
      'grao de bico',
      'grão de bico',
      'pipoca',
      'snack',
      'salgadinho',
    ],
  },
  {
    aisle: 'outros',
    words: [
      'racao',
      'ração',
      'pet',
      'cachorro',
      'gato',
      'areia',
      'pilha',
      'bateria',
      'lampada',
      'lâmpada',
      'isqueiro',
      'fita',
      'remedio',
      'remédio',
      'vitamina',
      'protetor',
      'filtro',
    ],
  },
]

/**
 * Infere a secção do supermercado a partir do nome do produto.
 * Frases compostas por inclusão; palavras soltas só batem em token exacto
 * (evita “sal” apanhar “salada”).
 */
export function guessShoppingAisle(name: string): ShoppingAisle {
  const key = normalizeProductKey(name)
  if (!key) return 'outros'
  const tokens = key.split(' ').filter(Boolean)

  for (const group of AISLE_KEYWORDS) {
    for (const raw of group.words) {
      const word = normalizeProductKey(raw)
      if (!word) continue
      if (word.includes(' ')) {
        if (key.includes(word)) return group.aisle
        continue
      }
      if (tokens.includes(word)) return group.aisle
      // nomes compostos tipo “morangos”, “bananas”
      if (
        word.length >= 4 &&
        tokens.some(
          (t) =>
            t === word ||
            t === `${word}s` ||
            t === `${word}es` ||
            (t.startsWith(word) && t.length <= word.length + 2),
        )
      ) {
        return group.aisle
      }
    }
  }
  return 'outros'
}

export function aisleLabel(aisle: ShoppingAisle) {
  return SHOPPING_AISLES.find((a) => a.id === aisle)?.label ?? 'Outros'
}

export function emptyComprasState(): ComprasState {
  return {
    needed: [],
    lists: [],
    activeListId: null,
    aisleMemory: {},
  }
}

export function productMemoryKey(name: string) {
  return normalizeProductKey(name)
}

/** Secção: memória do utilizador > palavras-chave > outros. */
export function resolveShoppingAisle(
  name: string,
  memory?: Record<string, ShoppingAisle> | null,
  explicit?: ShoppingAisle,
): ShoppingAisle {
  if (explicit) return explicit
  const key = productMemoryKey(name)
  if (key && memory && memory[key]) return memory[key]
  return guessShoppingAisle(name)
}

export function createNeededItem(name: string, note?: string): NeededItem {
  return {
    id: uid('need'),
    name: name.trim(),
    note: note?.trim() || undefined,
    createdAt: new Date().toISOString(),
  }
}

export function createShoppingItem(input: {
  name: string
  qty?: number
  unit?: string
  estimatedPrice?: number
  aisle?: ShoppingAisle
  fromNeededId?: string
  aisleMemory?: Record<string, ShoppingAisle>
}): ShoppingItem {
  const qty =
    input.qty !== undefined && Number.isFinite(input.qty) && input.qty > 0
      ? Math.round(input.qty * 100) / 100
      : undefined
  const price =
    input.estimatedPrice !== undefined &&
    Number.isFinite(input.estimatedPrice) &&
    input.estimatedPrice > 0
      ? Math.round(input.estimatedPrice * 100) / 100
      : undefined
  const name = input.name.trim()
  return {
    id: uid('item'),
    name,
    qty,
    unit: input.unit?.trim() || undefined,
    checked: false,
    estimatedPrice: price,
    aisle: resolveShoppingAisle(name, input.aisleMemory, input.aisle),
    fromNeededId: input.fromNeededId,
    createdAt: new Date().toISOString(),
  }
}

export function createShoppingList(title?: string): ShoppingList {
  const today = dateKey()
  return {
    id: uid('list'),
    title: (title?.trim() || `Compras ${today.slice(8)}/${today.slice(5, 7)}`).trim(),
    status: 'active',
    items: [],
    createdAt: new Date().toISOString(),
    completedAt: null,
    financeTxId: null,
    totalSpent: null,
    financeCategory: null,
  }
}

export function cloneListAsActive(source: ShoppingList, title?: string): ShoppingList {
  const base = createShoppingList(title || source.title)
  return {
    ...base,
    items: source.items.map((item) =>
      createShoppingItem({
        name: item.name,
        qty: item.qty,
        unit: item.unit,
        estimatedPrice: item.estimatedPrice,
        aisle: item.aisle,
      }),
    ),
  }
}

export function estimatedListTotal(list: ShoppingList | null | undefined): number {
  if (!list) return 0
  return Math.round(
    list.items.reduce((sum, item) => {
      const unit = item.estimatedPrice ?? 0
      const qty = item.qty && item.qty > 0 ? item.qty : 1
      return sum + unit * qty
    }, 0) * 100,
  ) / 100
}

export function pendingCount(list: ShoppingList | null | undefined): number {
  if (!list) return 0
  return list.items.filter((i) => !i.checked).length
}

export function checkedCount(list: ShoppingList | null | undefined): number {
  if (!list) return 0
  return list.items.filter((i) => i.checked).length
}

export function normalizeAisle(value: unknown): ShoppingAisle {
  if (
    value === 'mercearia' ||
    value === 'frescos' ||
    value === 'limpeza' ||
    value === 'outros'
  ) {
    return value
  }
  return 'outros'
}
