import { brotliCompressSync, gzipSync } from 'node:zlib'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const assetsRoot = path.resolve('dist/assets')
const outputRoot = path.resolve('.canvas-results')
const manifestPath = path.resolve('dist/.vite/manifest.json')

function walk(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name)
    return statSync(file).isDirectory() ? walk(file) : [file]
  })
}

function measureFile(relativeFile) {
  const contents = readFileSync(path.resolve('dist', relativeFile))
  return {
    file: relativeFile,
    rawBytes: contents.byteLength,
    gzipBytes: gzipSync(contents).byteLength,
    brotliBytes: brotliCompressSync(contents).byteLength,
  }
}

const files = walk(assetsRoot)
  .filter((file) => /\.(js|css)$/.test(file))
  .map((file) => measureFile(path.relative(path.resolve('dist'), file)))

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry)
if (!entryKey) throw new Error('Vite manifest has no entry')
const reactFlowKey = 'src/features/review-board/engines/react-flow/ReactFlowReviewBoard.tsx'
const excalidrawKey = manifest[entryKey].dynamicImports.find((key) => key !== reactFlowKey)
if (!manifest[reactFlowKey] || !excalidrawKey || !manifest[excalidrawKey]) {
  throw new Error('Could not identify both canvas routes in the Vite manifest')
}

function routeFiles(routeKey) {
  const visited = new Set()
  const assets = new Set()
  function visit(key) {
    if (visited.has(key)) return
    visited.add(key)
    const item = manifest[key]
    if (!item) return
    if (item.file) assets.add(item.file)
    for (const file of item.css ?? []) assets.add(file)
    for (const file of item.assets ?? []) assets.add(file)
    for (const imported of item.imports ?? []) visit(imported)
  }
  visit(entryKey)
  visit(routeKey)
  return [...assets].sort().map(measureFile)
}

function routeReport(routeKey) {
  const assets = routeFiles(routeKey)
  return {
    entry: routeKey,
    initialAssets: assets,
    totals: assets.reduce((totals, asset) => ({
      rawBytes: totals.rawBytes + asset.rawBytes,
      gzipBytes: totals.gzipBytes + asset.gzipBytes,
      brotliBytes: totals.brotliBytes + asset.brotliBytes,
    }), { rawBytes: 0, gzipBytes: 0, brotliBytes: 0 }),
    optionalLazyAssetCount: manifest[routeKey].dynamicImports?.length ?? 0,
  }
}

mkdirSync(outputRoot, { recursive: true })
const report = {
  generatedAt: new Date().toISOString(),
  routes: {
    reactflow: routeReport(reactFlowKey),
    excalidraw: routeReport(excalidrawKey),
  },
  allJavaScriptAndCss: files,
}
writeFileSync(path.join(outputRoot, 'bundle.json'), JSON.stringify(report, null, 2))
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
