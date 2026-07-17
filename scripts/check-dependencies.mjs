import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { collectUnreviewedFindings } from './testing/dependency-audit-policy.mjs'

const root = process.cwd()
const failures = []

const packageJson = JSON.parse(readFileSync(`${root}/package.json`, 'utf8'))
const shippedDependencies = Object.keys(packageJson.dependencies ?? {})
if (shippedDependencies.includes('tldraw')) {
  failures.push('tldraw must not be a shipped dependency (see DECISIONS.md)')
}

const requiredMitLicenses = {
  '@xyflow/react': 'React Flow',
  '@excalidraw/excalidraw': 'Excalidraw',
}
for (const [packageName, label] of Object.entries(requiredMitLicenses)) {
  const installedPackageJson = JSON.parse(readFileSync(`${root}/node_modules/${packageName}/package.json`, 'utf8'))
  if (installedPackageJson.license !== 'MIT') {
    failures.push(`${label} (${packageName}) is licensed ${String(installedPackageJson.license)}, expected MIT for the public repository`)
  }
}

const audit = spawnSync('npm', ['audit', '--omit=dev', '--json'], { cwd: root, encoding: 'utf8' })
if (!audit.stdout) {
  failures.push(`npm audit produced no output: ${audit.stderr || 'unknown error'}`)
} else {
  const report = JSON.parse(audit.stdout)
  const unreviewed = collectUnreviewedFindings(report.vulnerabilities)
  for (const finding of unreviewed) {
    failures.push(`Unreviewed ${finding.severity} severity production finding: ${finding.name}. Record a reviewed reason in scripts/testing/dependency-audit-policy.mjs and DECISIONS.md before release.`)
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`)
  process.exit(1)
}

process.stdout.write('Dependency tree is ready for release.\n')
