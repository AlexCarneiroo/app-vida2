import fs from 'node:fs'

const src = 'C:/Users/Alex/.cursor/projects/c-Users-Alex-App-vida/agent-tools/c5ba32d1-0f18-4c06-bd90-204efb3d72f4.txt'
const raw = fs.readFileSync(src, 'utf8')

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (c === '"') {
        quoted = false
      } else {
        cell += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1
      row.push(cell)
      cell = ''
      if (row.some((x) => x.trim())) rows.push(row)
      row = []
    } else {
      cell += c
    }
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function num(value) {
  if (value == null || value === '' || value === 'NA' || value === 'tr') return 0
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0
}

const rows = parseCsv(raw)
const header = rows[0]
const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]))
const foods = []

for (const row of rows.slice(1)) {
  const id = String(row[idx.numero_alimento] || '').trim()
  const name = String(row[idx.descricao] || '').trim()
  if (!id || !name) continue
  const kcal = num(row[idx.energia_kcal])
  const protein = num(row[idx.proteina_g])
  const carbs = num(row[idx.carboidrato_g])
  const fat = num(row[idx.lipideos_g])
  if (kcal <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) continue
  foods.push({
    id: `taco_${id}`,
    name,
    brand: String(row[idx.categoria] || '').trim() || undefined,
    source: 'taco',
    per100: { kcal: Math.round(kcal), protein, carbs, fat },
  })
}

const out = new URL('../src/data/tacoFoods.ts', import.meta.url)
const body = `import type { FoodItem } from '../types/nutricao'

/** TACO 4ª ed. (NEPA/UNICAMP) — valores por 100 g de parte comestível. */
export const TACO_FOODS: FoodItem[] = ${JSON.stringify(foods, null, 2)}
`
fs.writeFileSync(out, body)
console.log(`${foods.length} foods, ${Math.round(body.length / 1024)}kb`)
