import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const allowedRootMarkdown = new Set(['AGENTS.md', 'CLAUDE.md', 'DECISIONS.md', 'README.md', 'tickets.md'])
const ignoredDirectories = new Set(['.git', '.canvas-results', 'dist', 'node_modules', 'playwright-report', 'test-results'])
const bannedSourceDirectories = new Set(['common', 'core', 'helpers', 'lib', 'utils'])
const bannedSourceFiles = new Set(['core.ts', 'helpers.ts', 'types.ts', 'utils.ts'])
const taskMarkerPattern = new RegExp(`\\b(?:${['TO', 'DO'].join('')}|${['FIX', 'ME'].join('')})\\b`)
const failures = []

function walk(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && (ignoredDirectories.has(entry.name) || entry.name.startsWith('.'))) return []
    const entryPath = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(entryPath) : [entryPath]
  })
}

for (const file of walk(root)) {
  const relative = path.relative(root, file)
  const parts = relative.split(path.sep)
  const isSpec = parts[0] === 'specs' && parts.length === 2
  if (file.endsWith('.md') && !allowedRootMarkdown.has(relative) && !isSpec) {
    failures.push(`${relative}: Markdown is limited to the repository map and decision files`)
  }
  if (parts[0] === 'src') {
    const bannedDirectory = parts.find((part) => bannedSourceDirectories.has(part))
    if (bannedDirectory) failures.push(`${relative}: banned source directory ${bannedDirectory}`)
    if (bannedSourceFiles.has(path.basename(file))) failures.push(`${relative}: use a specific file name`)
  }
  if (/\.(?:[cm]?[jt]sx?|css|html)$/.test(file)) {
    const contents = readFileSync(file, 'utf8')
    if (taskMarkerPattern.test(contents)) failures.push(`${relative}: move task state to an issue`)
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`)
  process.exit(1)
}

process.stdout.write('Repository shape is valid.\n')
