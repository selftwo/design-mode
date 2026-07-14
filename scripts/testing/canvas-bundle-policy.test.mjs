import { describe, expect, it } from 'vitest'
import {
  EXCALIDRAW_ROUTE_NAME,
  REACT_FLOW_GZIP_CAP_BYTES,
  REACT_FLOW_ROUTE_KEY,
  assertManifestRouteKeys,
  collectBundlePolicyFailures,
  optionalManifestKeys,
  routeStaticGraph,
  sourceMapContainsSource,
} from './canvas-bundle-policy.mjs'

const EXCALIDRAW_MANIFEST_KEY = '_optional-excalidraw.js'

const minimalManifest = {
  'index.html': {
    isEntry: true,
    file: 'assets/index.js',
    dynamicImports: [REACT_FLOW_ROUTE_KEY, EXCALIDRAW_MANIFEST_KEY],
    css: ['assets/index.css'],
  },
  [REACT_FLOW_ROUTE_KEY]: {
    file: 'assets/react-flow.js',
    css: ['assets/react-flow.css'],
    imports: ['index.html'],
  },
  [EXCALIDRAW_MANIFEST_KEY]: {
    file: 'assets/excalidraw.js',
    name: EXCALIDRAW_ROUTE_NAME,
    css: ['assets/excalidraw.css'],
    imports: ['index.html', 'node_modules/@excalidraw/excalidraw/dist/prod/index.js'],
    dynamicImports: ['node_modules/@excalidraw/excalidraw/dist/prod/locales/en.json'],
  },
  'node_modules/@excalidraw/excalidraw/dist/prod/index.js': {
    file: 'assets/excal-core.js',
    css: ['assets/percentages-BXMCSKIN.css'],
    assets: ['assets/Assistant-Regular.woff2'],
  },
}

describe('canvas bundle policy', () => {
  it('requires both explicit route keys on the app entry dynamicImports', () => {
    expect(assertManifestRouteKeys(minimalManifest)).toEqual({
      entryKey: 'index.html',
      excalidrawRouteKey: EXCALIDRAW_MANIFEST_KEY,
    })
    expect(() => assertManifestRouteKeys({})).toThrow(/no entry/)
    expect(() => assertManifestRouteKeys({
      'index.html': { isEntry: true, dynamicImports: [REACT_FLOW_ROUTE_KEY] },
      [REACT_FLOW_ROUTE_KEY]: { file: 'a.js' },
    })).toThrow(EXCALIDRAW_ROUTE_NAME)
  })

  it('uses entry static graph plus route static graph without inferring optional routes', () => {
    const reactFlowGraph = routeStaticGraph(minimalManifest, 'index.html', REACT_FLOW_ROUTE_KEY)
    expect(reactFlowGraph.visitedKeys).toEqual(expect.arrayContaining(['index.html', REACT_FLOW_ROUTE_KEY]))
    expect(optionalManifestKeys(reactFlowGraph.visitedKeys)).toEqual([])
    const excalidrawGraph = routeStaticGraph(minimalManifest, 'index.html', EXCALIDRAW_MANIFEST_KEY)
    expect(optionalManifestKeys(excalidrawGraph.visitedKeys)).toContain(
      'node_modules/@excalidraw/excalidraw/dist/prod/index.js',
    )
  })

  it('binds the named optional chunk to the Excalidraw adapter source', () => {
    expect(sourceMapContainsSource({
      sources: ['../../src/features/review-board/engines/excalidraw/ExcalidrawReviewBoard.tsx'],
    }, 'src/features/review-board/engines/excalidraw/ExcalidrawReviewBoard.tsx')).toBe(true)
    expect(sourceMapContainsSource({ sources: ['src/unrelated.ts'] },
      'src/features/review-board/engines/excalidraw/ExcalidrawReviewBoard.tsx')).toBe(false)
  })

  it('fails when React Flow gzip exceeds the reference allowance', () => {
    const failures = collectBundlePolicyFailures({
      routes: {
        reactflow: {
          entry: REACT_FLOW_ROUTE_KEY,
          initialAssets: [{ file: 'assets/react-flow.js', rawBytes: 1, gzipBytes: REACT_FLOW_GZIP_CAP_BYTES + 1, brotliBytes: 1 }],
          totals: { rawBytes: 1, gzipBytes: REACT_FLOW_GZIP_CAP_BYTES + 1, brotliBytes: 1 },
          optionalLazyAssetCount: 0,
        },
        excalidraw: {
          entry: EXCALIDRAW_MANIFEST_KEY,
          initialAssets: [{ file: 'assets/excal-core.js', rawBytes: 1, gzipBytes: 1, brotliBytes: 1 }],
          totals: { rawBytes: 1, gzipBytes: 1, brotliBytes: 1 },
          optionalLazyAssetCount: 1,
        },
      },
      reactFlowVisitedKeys: ['index.html', REACT_FLOW_ROUTE_KEY],
      excalidrawVisitedKeys: ['index.html', EXCALIDRAW_MANIFEST_KEY, 'node_modules/@excalidraw/excalidraw/dist/prod/index.js'],
    })
    expect(failures.some((message) => message.includes('exceeds cap'))).toBe(true)
  })

  it('fails when React Flow static graph reaches excalidraw manifest modules', () => {
    const failures = collectBundlePolicyFailures({
      routes: {
        reactflow: {
          entry: REACT_FLOW_ROUTE_KEY,
          initialAssets: [{ file: 'assets/react-flow.js', rawBytes: 1, gzipBytes: 1, brotliBytes: 1 }],
          totals: { rawBytes: 1, gzipBytes: 1, brotliBytes: 1 },
          optionalLazyAssetCount: 0,
        },
        excalidraw: {
          entry: EXCALIDRAW_MANIFEST_KEY,
          initialAssets: [{ file: 'assets/excal-core.js', rawBytes: 1, gzipBytes: 1, brotliBytes: 1 }],
          totals: { rawBytes: 1, gzipBytes: 1, brotliBytes: 1 },
          optionalLazyAssetCount: 1,
        },
      },
      reactFlowVisitedKeys: ['index.html', REACT_FLOW_ROUTE_KEY, 'node_modules/@excalidraw/excalidraw/dist/prod/index.js'],
      excalidrawVisitedKeys: ['index.html', EXCALIDRAW_MANIFEST_KEY, 'node_modules/@excalidraw/excalidraw/dist/prod/index.js'],
    })
    expect(failures.some((message) => message.includes('optional-only manifest keys'))).toBe(true)
  })
})