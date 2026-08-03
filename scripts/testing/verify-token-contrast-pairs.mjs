import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

function parseHex(hex) {
  const normalized = hex.replace('#', '')
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized.slice(0, 6)
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return { r, g, b }
}

function luminance({ r, g, b }) {
  const channel = (value) => {
    const scaled = value / 255
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(foreground, background)
  const darker = Math.min(foreground, background)
  return (lighter + 0.05) / (darker + 0.05)
}

const tokens = {
  light: {
    '--ink': '#171a21',
    '--ink-secondary': '#444a5a',
    '--ink-muted': '#565e70',
    '--canvas': '#eaedf4',
    '--surface': '#ffffff',
    '--surface-sunken': '#eef1f6',
    '--accent': '#5b57d9',
    '--accent-strong': '#4340bd',
    '--accent-ink': '#ffffff',
    '--accent-text': '#4a46c8',
    '--mark-text': '#bb2d47',
    '--anno-surface': '#fdf0ea',
    '--teach-ink': '#0b6e63',
    '--teach-surface': '#e9f6f4',
    '--danger': '#b42318',
    '--danger-bg': '#fdf1ef',
    '--warn': '#9a4a08',
    '--warn-bg': '#fdf5e7',
    '--ok': '#067647',
    '--ok-bg': '#edf9f2',
    '--info': '#175cd3',
    '--info-bg': '#eff4fd',
  },
  dark: {
    '--ink': '#e8ebf5',
    '--ink-secondary': '#a9b2cc',
    '--ink-muted': '#8892b0',
    '--canvas': '#232838',
    '--surface': '#141927',
    '--surface-sunken': '#101523',
    '--accent': '#5b57d9',
    '--accent-strong': '#6360e2',
    '--accent-ink': '#ffffff',
    '--accent-text': '#9895ff',
    '--mark-text': '#f2848f',
    '--anno-surface': '#33221e',
    '--teach-ink': '#4fc9b8',
    '--teach-surface': '#122f2b',
    '--danger': '#f2887e',
    '--danger-bg': '#381f21',
    '--warn': '#efa64f',
    '--warn-bg': '#33270f',
    '--ok': '#57cf95',
    '--ok-bg': '#14352a',
    '--info': '#8fb3ff',
    '--info-bg': '#1a2745',
  },
}

const pairs = [
  ['--ink', '--canvas', 4.5, 'body on canvas'],
  ['--ink', '--surface', 4.5, 'body on island'],
  ['--ink-secondary', '--canvas', 4.5, 'support on canvas'],
  ['--ink-secondary', '--surface', 4.5, 'support on island'],
  ['--ink-muted', '--canvas', 4.5, 'meta on canvas'],
  ['--ink-muted', '--surface', 4.5, 'meta on island'],
  ['--ink-muted', '--anno-surface', 4.5, 'meta on coral paper'],
  ['--ink-muted', '--teach-surface', 4.5, 'meta on teal paper'],
  ['--accent-ink', '--accent', 4.5, 'primary button label'],
  ['--accent-ink', '--accent-strong', 4.5, 'pressed button label'],
  ['--accent-text', '--surface', 4.5, 'violet small text on island'],
  ['--accent-text', '--canvas', 4.5, 'violet small text on canvas'],
  ['--mark-text', '--surface', 4.5, 'coral small text on island'],
  ['--mark-text', '--anno-surface', 4.5, 'coral small text on coral paper'],
  ['--teach-ink', '--teach-surface', 4.5, 'teach ink on teal paper'],
  ['--danger', '--danger-bg', 4.5, 'error notice'],
  ['--warn', '--warn-bg', 4.5, 'warn notice'],
  ['--ok', '--ok-bg', 4.5, 'success notice'],
  ['--info', '--info-bg', 4.5, 'info notice'],
]

const results = []
for (const [theme, palette] of Object.entries(tokens)) {
  for (const [foreground, background, minimum, label] of pairs) {
    const ratio = contrastRatio(
      luminance(parseHex(palette[foreground])),
      luminance(parseHex(palette[background])),
    )
    results.push({
      theme,
      pair: `${foreground} on ${background}`,
      label,
      ratio: Number(ratio.toFixed(2)),
      minimum,
      pass: ratio >= minimum,
    })
  }
}

const failures = results.filter((item) => !item.pass)
if (failures.length > 0) {
  process.stderr.write(`${JSON.stringify({ failures }, null, 2)}\n`)
  process.exit(1)
}

const out = path.resolve('.scratch/designmode-pivot/gate-04-evidence/contrast-pairs.json')
mkdirSync(path.dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), items: results }, null, 2))
process.stdout.write(`Verified ${results.length} token pairs; wrote ${out}\n`)
