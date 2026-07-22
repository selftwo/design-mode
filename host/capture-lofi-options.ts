import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'
import { z } from 'zod'
import {
  FrameKitSchema,
  KitManifestSchema,
  ScreenFrameSchema,
  type FrameKit,
  type KitManifest,
  type KitStateValue,
  type ScreenFrame,
} from '../src/features/review-board/model/board-document.schema.ts'
import { addFrameKitRelationIssues } from '../src/features/review-board/model/board-relations.ts'
import { collectFrameElementsInPage } from './extract-frame-elements.ts'
import { checkPlayableScratchHtml } from './playable-option-bridge.ts'

const CAPTURE_VIEWPORT = { width: 1440, height: 900 }
const DISPLAY_WIDTH = 420
const PLAYABLE_PROTOCOL_VERSION = 1 as const

// FrameKitSchema plus the same cross-field relation rules the board enforces on
// load, so a captured kit is rejected here for the same reasons it would be
// rejected later (duplicate control ids, a choice default outside its options,
// state that does not match the manifest).
const CheckedFrameKitSchema = FrameKitSchema.superRefine((kit, context) => {
  addFrameKitRelationIssues(kit, context, [])
})

interface OptionArtifact {
  fileName: string
  html: string
  artifactHash: string
  kit: FrameKit
}

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'unknown validation error'
  const at = issue.path.join('.')
  return at ? `${at}: ${issue.message}` : issue.message
}

function decodeUtf8(buffer: Buffer, fileName: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    throw new Error(`Option artifact "${fileName}" is not valid UTF-8`)
  }
}

function deriveKitState(manifest: KitManifest): Record<string, KitStateValue> {
  const state: Record<string, KitStateValue> = {}
  for (const control of manifest.controls) {
    state[control.id] = control.default
  }
  return state
}

function parseKit(text: string, fileName: string): FrameKit {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (error) {
    throw new Error(`${fileName} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
  const manifestResult = KitManifestSchema.safeParse(json)
  if (!manifestResult.success) {
    throw new Error(`${fileName} is not a valid kit manifest: ${firstIssue(manifestResult.error)}`)
  }
  const state = deriveKitState(manifestResult.data)
  const kitResult = CheckedFrameKitSchema.safeParse({ manifest: manifestResult.data, state })
  if (!kitResult.success) {
    throw new Error(`${fileName} has an invalid kit manifest: ${firstIssue(kitResult.error)}`)
  }
  return kitResult.data
}

// Reads the exact set of option-N.html + option-N.kit.json pairs the run was
// asked to produce, validates every pair, and returns them in numeric order.
// Throws on the first fault, naming the file, before any browser work runs, so a
// bad or incomplete set never reaches a screenshot or a board write.
function loadOptionArtifacts(optionDir: string, expectedCount: number): OptionArtifact[] {
  if (!Number.isInteger(expectedCount) || expectedCount < 1) {
    throw new Error(`Expected a positive option count, received ${String(expectedCount)}`)
  }

  const expected = new Set<string>()
  for (let index = 1; index <= expectedCount; index += 1) {
    expected.add(`option-${index}.html`)
    expected.add(`option-${index}.kit.json`)
  }

  // Ignore dotfiles (OS cruft), but reject any other unexpected entry so a
  // stray or extra option cannot slip into the set unnoticed.
  const present = new Map<string, boolean>()
  for (const entry of readdirSync(optionDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    present.set(entry.name, entry.isFile())
  }
  for (const [name, isFile] of present) {
    if (!expected.has(name)) {
      throw new Error(`Unexpected file "${name}" in the option set; expected only option-1..${expectedCount} html and kit.json pairs`)
    }
    if (!isFile) {
      throw new Error(`Option artifact "${name}" is not a regular file`)
    }
  }

  const artifacts: OptionArtifact[] = []
  for (let index = 1; index <= expectedCount; index += 1) {
    const fileName = `option-${index}.html`
    const kitFileName = `option-${index}.kit.json`
    for (const name of [fileName, kitFileName]) {
      if (!present.has(name)) throw new Error(`Missing option artifact "${name}"`)
    }

    const htmlBuffer = readFileSync(path.join(optionDir, fileName))
    const kitBuffer = readFileSync(path.join(optionDir, kitFileName))

    const html = decodeUtf8(htmlBuffer, fileName)
    const htmlCheck = checkPlayableScratchHtml(html)
    if (!htmlCheck.ok) {
      throw new Error(`${fileName} is not a valid playable option: ${htmlCheck.reason}`)
    }

    const kit = parseKit(decodeUtf8(kitBuffer, kitFileName), kitFileName)

    // Hash the exact stored bytes, HTML first then kit, so any change to either
    // file (even one that parses to the same manifest) changes the hash. The
    // served bridge script is never part of this digest.
    const artifactHash = createHash('sha256').update(htmlBuffer).update(kitBuffer).digest('hex')

    artifacts.push({ fileName, html, artifactHash, kit })
  }
  return artifacts
}

// Validates the run's option artifacts, then renders each option-N.html through
// the same Playwright capture used for real routes and emits a live, playable
// frame carrying its scratch-html live source and control kit. baseUrl is the
// directory URL the host serves the option set's files from (no trailing slash).
// Capture identity (`runId`) is kept separate from ownership (`unitId`): frame
// ids and scratch paths are run-scoped so two runs for one unit never collide,
// while every frame's `unitId` names the durable unit. Rejects the whole set if
// any artifact pair is missing or invalid, before taking a single screenshot.
export async function captureLofiOptions(options: {
  optionDir: string
  baseUrl: string
  runId: string
  unitId: string
  expectedCount: number
}): Promise<ScreenFrame[]> {
  const { optionDir, baseUrl, runId, unitId, expectedCount } = options
  const artifacts = loadOptionArtifacts(optionDir, expectedCount)

  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: CAPTURE_VIEWPORT })
    const frames: ScreenFrame[] = []
    for (const artifact of artifacts) {
      const label = artifact.fileName.replace(/\.html$/, '')
      const frameId = `${runId}-${label}`
      const fileUrl = `${baseUrl}/${artifact.fileName}`
      const livePath = new URL(fileUrl).pathname
      await page.goto(fileUrl, { waitUntil: 'load' })
      const elements = await page.evaluate(collectFrameElementsInPage, frameId)
      const screenshot = await page.screenshot({ fullPage: false })
      const aspectRatio = CAPTURE_VIEWPORT.width / CAPTURE_VIEWPORT.height
      const dataUrl = `data:image/png;base64,${screenshot.toString('base64')}`
      frames.push(ScreenFrameSchema.parse({
        id: frameId,
        label,
        route: livePath,
        viewport: CAPTURE_VIEWPORT,
        x: 0,
        y: 0,
        width: DISPLAY_WIDTH,
        height: DISPLAY_WIDTH / aspectRatio,
        aspectRatio,
        screenshotPath: `screens/${frameId}.png`,
        screenshotDataUrl: dataUrl,
        refreshedScreenshotDataUrl: dataUrl,
        // captureHash tracks the visual pixels; artifactHash tracks the source
        // bytes. They have separate jobs and separate algorithms.
        captureHash: createHash('sha1').update(screenshot).digest('hex'),
        revision: 1,
        elements,
        kind: 'playable-option',
        lifeState: 'active',
        unitId,
        liveSource: {
          kind: 'scratch-html',
          path: livePath,
          protocolVersion: PLAYABLE_PROTOCOL_VERSION,
          artifactHash: artifact.artifactHash,
        },
        kit: artifact.kit,
      }))
    }
    return frames
  } finally {
    await browser.close()
  }
}
