import { brotliCompressSync, gzipSync } from 'node:zlib'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** @typedef {{ file: string, rawBytes: number, gzipBytes: number, brotliBytes: number }} MeasuredAsset */
/** @typedef {{ entry: string, initialAssets: MeasuredAsset[], totals: { rawBytes: number, gzipBytes: number, brotliBytes: number }, optionalLazyAssetCount: number }} RouteReport */

export const REACT_FLOW_ROUTE_KEY = 'src/features/review-board/engines/react-flow/ReactFlowReviewBoard.tsx'
export const EXCALIDRAW_ADAPTER_SOURCE = 'src/features/review-board/engines/excalidraw/ExcalidrawReviewBoard.tsx'
export const EXCALIDRAW_ROUTE_NAME = 'percentages-BXMCSKIN'
// Re-baselined 2026-07-16 after the pooled comments panel, freehand ink marks,
// and element picking shipped; see DECISIONS.md. The cap still fails the gate on
// accidental growth such as optional engine code leaking into the default route.
export const REACT_FLOW_GZIP_REFERENCE_BYTES = 140_617
export const REACT_FLOW_GZIP_CAP_BYTES = Math.floor(REACT_FLOW_GZIP_REFERENCE_BYTES * 1.2)

const OPTIONAL_MANIFEST_MARKERS = [
  '@excalidraw/excalidraw',
  'ExcalidrawReviewBoard',
  'excalidraw-vendor',
  'excalidraw-review-board',
  'percentages-BXMCSKIN',
]

const OPTIONAL_BUILT_ASSET_PATTERN = /excalidraw-vendor|excalidraw-review-board|percentages-BXMCSKIN|subset-shared|subset-worker|Assistant-(?:Regular|Medium|SemiBold|Bold)/

export function measureFile(relativeFile, distRoot) {
  const contents = readFileSync(path.resolve(distRoot, relativeFile))
  return {
    file: relativeFile,
    rawBytes: contents.byteLength,
    gzipBytes: gzipSync(contents).byteLength,
    brotliBytes: brotliCompressSync(contents).byteLength,
  }
}

function manifestEntryKey(manifest) {
  const entryKey = Object.keys(manifest).find((key) => {
    const item = manifest[key]
    return item && typeof item === 'object' && 'isEntry' in item && item.isEntry === true
  })
  if (!entryKey) throw new Error('Vite manifest has no entry')
  return entryKey
}

export function staticGraphForKeys(manifest, keys) {
  const visited = new Set()
  const assets = new Set()
  const visitedKeys = new Set()

  function visit(key) {
    if (visited.has(key)) return
    visited.add(key)
    visitedKeys.add(key)
    const item = manifest[key]
    if (!item || typeof item !== 'object') return
    if ('file' in item && typeof item.file === 'string') assets.add(item.file)
    if ('css' in item && Array.isArray(item.css)) {
      for (const file of item.css) assets.add(file)
    }
    if ('assets' in item && Array.isArray(item.assets)) {
      for (const file of item.assets) assets.add(file)
    }
    if ('imports' in item && Array.isArray(item.imports)) {
      for (const imported of item.imports) visit(imported)
    }
  }

  for (const key of keys) visit(key)
  return { assets: [...assets].sort(), visitedKeys: [...visitedKeys] }
}

export function entryStaticVisitedKeys(manifest, entryKey) {
  return staticGraphForKeys(manifest, [entryKey]).visitedKeys
}

export function routeStaticGraph(manifest, entryKey, routeKey) {
  return staticGraphForKeys(manifest, [entryKey, routeKey])
}

export function assertManifestRouteKeys(manifest) {
  const entryKey = manifestEntryKey(manifest)
  if (!manifest[REACT_FLOW_ROUTE_KEY]) {
    throw new Error(`Vite manifest is missing React Flow route key ${REACT_FLOW_ROUTE_KEY}`)
  }
  const entry = manifest[entryKey]
  if (!entry || typeof entry !== 'object' || !('dynamicImports' in entry) || !Array.isArray(entry.dynamicImports)) {
    throw new Error('Vite manifest entry is missing dynamicImports')
  }
  if (!entry.dynamicImports.includes(REACT_FLOW_ROUTE_KEY)) {
    throw new Error('Vite manifest entry does not dynamic-import React Flow by explicit route key')
  }
  const excalidrawRouteKey = entry.dynamicImports.find((key) => manifest[key]?.name === EXCALIDRAW_ROUTE_NAME)
  if (!excalidrawRouteKey) {
    throw new Error(`Vite manifest entry is missing the ${EXCALIDRAW_ROUTE_NAME} chunk for ${EXCALIDRAW_ADAPTER_SOURCE}`)
  }
  return { entryKey, excalidrawRouteKey }
}

export function optionalManifestKeys(visitedKeys) {
  return visitedKeys.filter((key) => OPTIONAL_MANIFEST_MARKERS.some((marker) => key.includes(marker)))
}

export function sourceMapContainsSource(sourceMap, expectedSource) {
  return Array.isArray(sourceMap.sources)
    && sourceMap.sources.some((source) => typeof source === 'string' && source.endsWith(expectedSource))
}

function assertRouteSourceMap(manifest, distRoot, routeKey, expectedSource) {
  const route = manifest[routeKey]
  const sourceMapPath = path.resolve(distRoot, `${route.file}.map`)
  if (!existsSync(sourceMapPath)) throw new Error(`Missing route source map ${sourceMapPath}`)
  const sourceMap = JSON.parse(readFileSync(sourceMapPath, 'utf8'))
  if (!sourceMapContainsSource(sourceMap, expectedSource)) {
    throw new Error(`Route ${routeKey} does not contain adapter source ${expectedSource}`)
  }
}

export function routeReport(manifest, distRoot, entryKey, routeKey) {
  const { assets: assetPaths } = routeStaticGraph(manifest, entryKey, routeKey)
  const initialAssets = assetPaths.map((file) => measureFile(file, distRoot))
  const routeManifest = manifest[routeKey]
  const optionalLazyAssetCount = routeManifest && typeof routeManifest === 'object' && 'dynamicImports' in routeManifest && Array.isArray(routeManifest.dynamicImports)
    ? routeManifest.dynamicImports.length
    : 0
  return {
    entry: routeKey,
    initialAssets,
    totals: initialAssets.reduce((totals, asset) => ({
      rawBytes: totals.rawBytes + asset.rawBytes,
      gzipBytes: totals.gzipBytes + asset.gzipBytes,
      brotliBytes: totals.brotliBytes + asset.brotliBytes,
    }), { rawBytes: 0, gzipBytes: 0, brotliBytes: 0 }),
    optionalLazyAssetCount,
  }
}

export function collectBundlePolicyFailures(input) {
  const failures = []
  const reactFlowGzip = input.routes.reactflow.totals.gzipBytes
  if (reactFlowGzip > REACT_FLOW_GZIP_CAP_BYTES) {
    failures.push(
      `React Flow initial gzip ${reactFlowGzip} exceeds cap ${REACT_FLOW_GZIP_CAP_BYTES} (reference ${REACT_FLOW_GZIP_REFERENCE_BYTES} + 20%)`,
    )
  }

  const entryOptional = optionalManifestKeys(input.entryVisitedKeys ?? [])
  if (entryOptional.length > 0) {
    failures.push(`App entry static graph reaches optional-only manifest keys: ${entryOptional.join(', ')}`)
  }

  const reactFlowOptionalKeys = optionalManifestKeys(input.reactFlowVisitedKeys)
  if (reactFlowOptionalKeys.length > 0) {
    failures.push(`React Flow route static graph reaches optional-only manifest keys: ${reactFlowOptionalKeys.join(', ')}`)
  }

  const leakedOptionalAssets = input.routes.reactflow.initialAssets.filter((asset) => OPTIONAL_BUILT_ASSET_PATTERN.test(asset.file))
  if (leakedOptionalAssets.length > 0) {
    failures.push(`React Flow route includes optional-only built assets: ${leakedOptionalAssets.map((asset) => asset.file).join(', ')}`)
  }

  if (optionalManifestKeys(input.excalidrawVisitedKeys).length === 0) {
    failures.push('Excalidraw route static graph does not reach any optional manifest modules')
  }

  if (input.routes.reactflow.entry !== REACT_FLOW_ROUTE_KEY) {
    failures.push(`React Flow route report used wrong entry ${input.routes.reactflow.entry}`)
  }
  return failures
}

export function buildCanvasBundleReport({ manifestPath, distRoot }) {
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing Vite manifest at ${manifestPath}`)
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const { entryKey, excalidrawRouteKey } = assertManifestRouteKeys(manifest)
  assertRouteSourceMap(manifest, distRoot, excalidrawRouteKey, EXCALIDRAW_ADAPTER_SOURCE)
  const reactFlowGraph = routeStaticGraph(manifest, entryKey, REACT_FLOW_ROUTE_KEY)
  const excalidrawGraph = routeStaticGraph(manifest, entryKey, excalidrawRouteKey)
  return {
    generatedAt: new Date().toISOString(),
    policy: {
      reactFlowGzipCapBytes: REACT_FLOW_GZIP_CAP_BYTES,
      reactFlowGzipReferenceBytes: REACT_FLOW_GZIP_REFERENCE_BYTES,
      reactFlowRouteKey: REACT_FLOW_ROUTE_KEY,
      excalidrawRouteKey,
      excalidrawAdapterSource: EXCALIDRAW_ADAPTER_SOURCE,
    },
    routes: {
      reactflow: routeReport(manifest, distRoot, entryKey, REACT_FLOW_ROUTE_KEY),
      excalidraw: routeReport(manifest, distRoot, entryKey, excalidrawRouteKey),
    },
    entryVisitedKeys: entryStaticVisitedKeys(manifest, entryKey),
    reactFlowVisitedKeys: reactFlowGraph.visitedKeys,
    excalidrawVisitedKeys: excalidrawGraph.visitedKeys,
  }
}

export function measureAndAssertCanvasBundles(options) {
  const report = buildCanvasBundleReport(options)
  return { report, failures: collectBundlePolicyFailures(report) }
}