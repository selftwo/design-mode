import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { measureAndAssertCanvasBundles } from './canvas-bundle-policy.mjs'

const assetsRoot = path.resolve('dist/assets')
const outputRoot = path.resolve('.canvas-results')
const manifestPath = path.resolve('dist/.vite/manifest.json')
const distRoot = path.resolve('dist')

function walk(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name)
    return statSync(file).isDirectory() ? walk(file) : [file]
  })
}

function measureAllJavaScriptAndCss() {
  return walk(assetsRoot)
    .filter((file) => /\.(js|css)$/.test(file))
    .map((file) => {
      const relativeFile = path.relative(distRoot, file)
      const contents = readFileSync(path.resolve(distRoot, relativeFile))
      return {
        file: relativeFile,
        rawBytes: contents.byteLength,
        gzipBytes: gzipSync(contents).byteLength,
      }
    })
}

const { report: assertedReport, failures } = measureAndAssertCanvasBundles({ manifestPath, distRoot })
if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`)
  process.exit(1)
}

const report = {
  generatedAt: assertedReport.generatedAt,
  policy: assertedReport.policy,
  routes: assertedReport.routes,
  allJavaScriptAndCss: measureAllJavaScriptAndCss(),
}

mkdirSync(outputRoot, { recursive: true })
writeFileSync(path.join(outputRoot, 'bundle.json'), JSON.stringify(report, null, 2))
process.stdout.write(`${JSON.stringify({
  policy: report.policy,
  routes: {
    reactflow: { entry: report.routes.reactflow.entry, totals: report.routes.reactflow.totals },
    excalidraw: { entry: report.routes.excalidraw.entry, totals: report.routes.excalidraw.totals },
  },
}, null, 2)}\n`)
