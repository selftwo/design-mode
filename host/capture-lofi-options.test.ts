import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BoardDocumentSchema } from '../src/features/review-board/model/board-document.schema.ts'
import { startDesignModeHost } from './design-mode-host.ts'
import { captureLofiOptions } from './capture-lofi-options.ts'
import { PLAYABLE_BRIDGE_HOOK } from './playable-option-bridge.ts'

const kitFixture = JSON.stringify({
  manifestVersion: 1,
  controls: [
    { kind: 'toggle', id: 'dense', label: 'Dense', default: false },
    {
      kind: 'choice',
      id: 'theme',
      label: 'Theme',
      options: [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ],
      default: 'light',
    },
  ],
})

function optionHtml(body: string): string {
  return `<html><head>${PLAYABLE_BRIDGE_HOOK}</head><body>${body}</body></html>`
}

describe('captureLofiOptions', () => {
  let dataDir: string
  let host: Awaited<ReturnType<typeof startDesignModeHost>>
  let projectId: string
  let runId: string
  let unitId: string
  let optionDir: string
  let baseUrl: string

  beforeEach(async () => {
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'design-mode-lofi-capture-'))
    host = await startDesignModeHost({
      port: 0,
      dataDir,
      distDir: path.join(dataDir, 'no-dist'),
      recaptureAfterRun: false,
    })
    projectId = 'proj-1'
    runId = 'run-1'
    unitId = 'unit-1'
    optionDir = path.join(dataDir, 'scratch', projectId, runId)
    mkdirSync(optionDir, { recursive: true })
    baseUrl = `${host.origin}/scratch/${projectId}/${runId}`
  })

  afterEach(async () => {
    await host.close()
    rmSync(dataDir, { recursive: true, force: true })
  })

  function writePair(index: number, body: string, kit: string = kitFixture) {
    writeFileSync(path.join(optionDir, `option-${index}.html`), optionHtml(body))
    writeFileSync(path.join(optionDir, `option-${index}.kit.json`), kit)
  }

  it('renders each option pair into a playable frame with a live source and kit', async () => {
    writePair(1, '<button>Sign in</button>')
    writePair(2, '<a href="/">Continue</a>')

    const frames = await captureLofiOptions({ optionDir, baseUrl, runId, unitId, expectedCount: 2 })

    expect(frames).toHaveLength(2)
    const first = frames[0]!
    // Frame ids and paths are run-scoped; ownership is the durable unit.
    expect(first.id).toBe(`${runId}-option-1`)
    expect(first.label).toBe('option-1')
    expect(first.kind).toBe('playable-option')
    expect(first.lifeState).toBe('active')
    expect(first.unitId).toBe(unitId)
    expect(first.route).toBe(`/scratch/${projectId}/${runId}/option-1.html`)
    expect(first.liveSource).toEqual({
      kind: 'scratch-html',
      path: `/scratch/${projectId}/${runId}/option-1.html`,
      protocolVersion: 1,
      artifactHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    })
    expect(first.kit!.state).toEqual({ dense: false, theme: 'light' })
    expect(first.screenshotDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(first.elements.some((element) => element.role === 'button')).toBe(true)
    expect(frames[1]!.id).toBe(`${runId}-option-2`)
  })

  it('produces frames that pass full board validation', async () => {
    writePair(1, '<button>One</button>')

    const frames = await captureLofiOptions({ optionDir, baseUrl, runId, unitId, expectedCount: 1 })

    const board = {
      schemaVersion: 2,
      boardId: 'board-1',
      documentRevision: 1,
      camera: { worldX: 0, worldY: 0, zoom: 1 },
      frames,
      annotations: [],
      units: [
        { id: unitId, label: 'Unit 1', brief: '', rules: [], dependsOnUnitIds: [], state: 'open' },
      ],
      zones: [],
      verdicts: [],
    }
    expect(BoardDocumentSchema.safeParse(board).success).toBe(true)
  })

  it('gives two runs of one unit distinct frame ids while both name that unit', async () => {
    writePair(1, '<button>One</button>')
    const firstRun = await captureLofiOptions({ optionDir, baseUrl, runId, unitId, expectedCount: 1 })

    const secondRunId = 'run-2'
    const secondDir = path.join(dataDir, 'scratch', projectId, secondRunId)
    mkdirSync(secondDir, { recursive: true })
    writeFileSync(path.join(secondDir, 'option-1.html'), optionHtml('<button>Two</button>'))
    writeFileSync(path.join(secondDir, 'option-1.kit.json'), kitFixture)
    const secondRun = await captureLofiOptions({
      optionDir: secondDir,
      baseUrl: `${host.origin}/scratch/${projectId}/${secondRunId}`,
      runId: secondRunId,
      unitId,
      expectedCount: 1,
    })

    expect(firstRun[0]!.id).toBe(`${runId}-option-1`)
    expect(secondRun[0]!.id).toBe(`${secondRunId}-option-1`)
    expect(firstRun[0]!.id).not.toBe(secondRun[0]!.id)
    expect(firstRun[0]!.unitId).toBe(unitId)
    expect(secondRun[0]!.unitId).toBe(unitId)
  })

  it('hashes the exact source bytes, so a whitespace change moves the hash', async () => {
    writePair(1, '<button>One</button>')
    const [before] = await captureLofiOptions({ optionDir, baseUrl, runId, unitId, expectedCount: 1 })
    // Same visible content, one extra space in the kit JSON.
    writeFileSync(path.join(optionDir, 'option-1.kit.json'), `${kitFixture} `)
    const [after] = await captureLofiOptions({ optionDir, baseUrl, runId, unitId, expectedCount: 1 })
    expect(after!.liveSource!.artifactHash).not.toBe(before!.liveSource!.artifactHash)
  })

  it('rejects a set that is missing a kit file, before capturing anything', async () => {
    writeFileSync(path.join(optionDir, 'option-1.html'), optionHtml('<button>One</button>'))
    await expect(captureLofiOptions({ optionDir, baseUrl, runId, unitId, expectedCount: 1 }))
      .rejects.toThrow(/option-1\.kit\.json/)
  })

  it('rejects the set when only some options are present', async () => {
    writePair(1, '<button>One</button>')
    await expect(captureLofiOptions({ optionDir, baseUrl, runId, unitId, expectedCount: 2 }))
      .rejects.toThrow(/option-2\.html/)
  })

  it('rejects an unexpected extra file', async () => {
    writePair(1, '<button>One</button>')
    writeFileSync(path.join(optionDir, 'notes.txt'), 'stray')
    await expect(captureLofiOptions({ optionDir, baseUrl, runId, unitId, expectedCount: 1 }))
      .rejects.toThrow(/notes\.txt/)
  })

  it('rejects HTML that omits the playable bridge hook', async () => {
    writeFileSync(path.join(optionDir, 'option-1.html'), '<html><body><button>One</button></body></html>')
    writeFileSync(path.join(optionDir, 'option-1.kit.json'), kitFixture)
    await expect(captureLofiOptions({ optionDir, baseUrl, runId, unitId, expectedCount: 1 }))
      .rejects.toThrow(/design-mode-playable-bridge/)
  })

  it('rejects HTML that carries an authored script', async () => {
    writeFileSync(path.join(optionDir, 'option-1.html'), optionHtml('<script>alert(1)</script>'))
    writeFileSync(path.join(optionDir, 'option-1.kit.json'), kitFixture)
    await expect(captureLofiOptions({ optionDir, baseUrl, runId, unitId, expectedCount: 1 }))
      .rejects.toThrow(/script/)
  })

  it('rejects invalid kit JSON', async () => {
    writeFileSync(path.join(optionDir, 'option-1.html'), optionHtml('<button>One</button>'))
    writeFileSync(path.join(optionDir, 'option-1.kit.json'), '{ not json')
    await expect(captureLofiOptions({ optionDir, baseUrl, runId, unitId, expectedCount: 1 }))
      .rejects.toThrow(/not valid JSON/)
  })

  it('rejects a kit with duplicate control ids', async () => {
    writeFileSync(path.join(optionDir, 'option-1.html'), optionHtml('<button>One</button>'))
    writeFileSync(path.join(optionDir, 'option-1.kit.json'), JSON.stringify({
      manifestVersion: 1,
      controls: [
        { kind: 'toggle', id: 'dense', label: 'Dense', default: false },
        { kind: 'toggle', id: 'dense', label: 'Dense again', default: true },
      ],
    }))
    await expect(captureLofiOptions({ optionDir, baseUrl, runId, unitId, expectedCount: 1 }))
      .rejects.toThrow(/Duplicate kit control/)
  })

  it('rejects a choice whose default is not one of its options', async () => {
    writeFileSync(path.join(optionDir, 'option-1.html'), optionHtml('<button>One</button>'))
    writeFileSync(path.join(optionDir, 'option-1.kit.json'), JSON.stringify({
      manifestVersion: 1,
      controls: [
        {
          kind: 'choice',
          id: 'theme',
          label: 'Theme',
          options: [{ value: 'light', label: 'Light' }],
          default: 'dark',
        },
      ],
    }))
    await expect(captureLofiOptions({ optionDir, baseUrl, runId, unitId, expectedCount: 1 }))
      .rejects.toThrow(/not one of its options/)
  })

  it('rejects the whole set when a later pair is bad, returning no frames', async () => {
    writePair(1, '<button>One</button>')
    writeFileSync(path.join(optionDir, 'option-2.html'), optionHtml('<button>Two</button>'))
    writeFileSync(path.join(optionDir, 'option-2.kit.json'), '{ broken')
    await expect(captureLofiOptions({ optionDir, baseUrl, runId, unitId, expectedCount: 2 }))
      .rejects.toThrow(/option-2\.kit\.json/)
  })
})
