import { expect, test, type Page } from '@playwright/test'
import type { BoardDocument, ScreenFrame } from '../../src/features/review-board/model/board-document.schema'
import { ensureZonesForUnit } from '../../src/features/review-board/model/ensure-zones-for-unit'
import { installFakeBoardHost } from './install-fake-board-host'
import { buildPlayableBoard, installPlayableOptionRoutes } from './install-playable-option-routes'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

interface Diagnostics {
  verdicts: Array<{ id: string; frameId: string }>
}

async function diagnostics(page: Page): Promise<Diagnostics> {
  return JSON.parse(await page.getByTestId('board-diagnostics').textContent() ?? '{}') as Diagnostics
}

// One reference image pinned to the same unit as the playable options, so a
// verdict can offer it.
function referenceFrame(): ScreenFrame {
  return {
    id: 'ref-a',
    label: 'Reference A',
    route: 'uploaded:ref-a.png',
    viewport: { width: 800, height: 600 },
    x: -300,
    y: 0,
    width: 220,
    height: 165,
    aspectRatio: 220 / 165,
    screenshotPath: 'uploads/ref-a.png',
    screenshotDataUrl: PNG,
    refreshedScreenshotDataUrl: PNG,
    captureHash: 'ref-a-hash',
    revision: 1,
    elements: [],
    kind: 'reference-image',
    lifeState: 'active',
    unitId: 'unit-1',
  }
}

function boardWithReference(): BoardDocument {
  const base = buildPlayableBoard(2)
  return ensureZonesForUnit({ ...base, frames: [...base.frames, referenceFrame()] }, 'unit-1')
}

test('reactflow: a verdict pre-selects the unit reference and the ledger shows it', async ({ page }) => {
  await installPlayableOptionRoutes(page)
  await installFakeBoardHost(page, boardWithReference())
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('board-status')).toContainText('3 screens', { timeout: 30_000 })

  await page.getByTestId('surface-p0').click({ position: { x: 10, y: 10 } })
  await expect(page.getByTestId('frame-kit-island')).toBeVisible()

  await page.getByTestId('frame-verdict-promote').click()
  await expect(page.getByTestId('verdict-bloom')).toBeVisible()

  // The unit's reference is offered and starts checked.
  await expect(page.getByTestId('verdict-references')).toBeVisible()
  await expect(page.getByTestId('verdict-reference-ref-a')).toBeChecked()

  await page.getByTestId('verdict-confirm').click()
  await expect.poll(async () => (await diagnostics(page)).verdicts.length).toBe(1)
  const verdictId = (await diagnostics(page)).verdicts[0]!.id

  // The confirmed decision links the reference in the ledger.
  await expect(page.getByTestId(`ledger-references-${verdictId}`)).toContainText('Reference A')
})
