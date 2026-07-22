import { BoardDocumentSchema, type BoardDocument, type DesignUnit } from './board-document.schema'
import { ensureZonesForUnit } from './ensure-zones-for-unit'

// The raw fields a reviewer types into the create-unit form. Rules arrive as one
// block of text, one rule per line; dependencies arrive as picked unit ids.
export interface NewDesignUnitInput {
  label: string
  brief: string
  rulesText: string
  dependsOnUnitIds: string[]
}

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function parseRules(rulesText: string): string[] {
  const rules: string[] = []
  const seen = new Set<string>()
  for (const line of rulesText.split(/\r?\n/)) {
    const rule = line.trim()
    if (!rule || seen.has(rule)) continue
    seen.add(rule)
    rules.push(rule)
  }
  return rules
}

function dedupe(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

// Builds a new open design unit from a reviewer's draft and appends it to the
// board. The result is validated with the full board schema (relations included)
// before it is returned, so a caller can trust the returned document is saveable.
// A fresh unit can depend on any current unit but nothing can yet depend on it,
// so this path cannot introduce a dependency cycle.
export function createDesignUnit(
  document: BoardDocument,
  input: NewDesignUnitInput,
  randomToken: () => string = () => globalThis.crypto.randomUUID().slice(0, 8),
): { unit: DesignUnit; document: BoardDocument } {
  const label = input.label.trim()
  const brief = input.brief.trim()
  if (!label) throw new Error('A unit needs a label.')
  if (!brief) throw new Error('A unit needs a brief.')

  const dependsOnUnitIds = dedupe(input.dependsOnUnitIds)
  const known = new Set(document.units.map((unit) => unit.id))
  for (const depId of dependsOnUnitIds) {
    if (!known.has(depId)) throw new Error(`Unknown dependency unit "${depId}".`)
  }

  const base = `${slug(label) || 'unit'}-${randomToken()}`
  let id = base
  for (let suffix = 2; known.has(id); suffix += 1) id = `${base}-${suffix}`

  const unit: DesignUnit = {
    id,
    label,
    brief,
    rules: parseRules(input.rulesText),
    dependsOnUnitIds,
    state: 'open',
  }
  // A fresh unit gets its archive and killed zones immediately so drag targets
  // exist before the first options land.
  const withUnit = { ...document, units: [...document.units, unit] }
  const next = BoardDocumentSchema.parse(ensureZonesForUnit(withUnit, unit.id))
  return { unit, document: next }
}
