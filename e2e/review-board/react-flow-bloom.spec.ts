import { expect, test, type Page } from '@playwright/test'
import { installFakeBoardHost } from './install-fake-board-host'

interface Diagnostics {
  annotations: Array<{ id: string; frameId: string; instruction: string; intent?: string }>
}

async function board(page: Page): Promise<Diagnostics> {
  return JSON.parse(await page.getByTestId('board-diagnostics').textContent() ?? '') as Diagnostics
}

async function framePoint(
  page: Page,
  frameId: string,
  normalized: readonly [number, number],
): Promise<{ x: number; y: number }> {
  const rect = await page.getByTestId(`surface-${frameId}`).boundingBox()
  if (!rect) throw new Error(`No rendered surface for ${frameId}`)
  return { x: rect.x + rect.width * normalized[0], y: rect.y + rect.height * normalized[1] }
}

test('reactflow: bloom threads open at marks and the comments rail jumps between them', async ({ page }) => {
  test.setTimeout(120_000)
  await installFakeBoardHost(page)
  await page.goto('/?engine=reactflow')
  await expect(page.getByTestId('board-status')).toContainText('50 screens', { timeout: 30_000 })
  await expect(page.getByTestId('reactflow-canvas')).toBeVisible()

  await page.getByTestId('tool-circle').click()
  const reviewFrame = 'frame-01'
  const circleStart = await framePoint(page, reviewFrame, [0.55, 0.55])
  const circleEnd = await framePoint(page, reviewFrame, [0.78, 0.78])
  await page.mouse.move(circleStart.x, circleStart.y)
  await page.mouse.down()
  await page.mouse.move(circleEnd.x, circleEnd.y, { steps: 8 })
  await page.mouse.up()

  const circle = (await board(page)).annotations.at(-1)!
  const bloom = page.getByTestId(`bloom-${circle.id}`)
  await expect(bloom).toBeVisible()
  await expect(bloom).toHaveAttribute('data-open', 'true')
  await expect(page.getByTestId('annotation-instruction-editor')).toBeVisible()
  await expect(page.getByTestId('instruction-input')).toBeFocused()

  await page.getByTestId('instruction-input').fill('Tighten the hero measure')
  await expect(page.getByTestId('instruction-complete')).toBeVisible()
  await page.getByTestId('intent-distill').click()
  await expect(page.getByTestId('intent-distill')).toHaveAttribute('aria-pressed', 'true')

  await page.getByTestId('resolve-annotation').click()
  await expect(bloom).toContainText('✓ resolved')
  await expect(page.getByTestId('resolve-annotation')).toHaveCount(0)

  await page.getByTestId('tool-comment').click()
  const commentAt = await framePoint(page, reviewFrame, [0.2, 0.75])
  await page.mouse.move(commentAt.x, commentAt.y)
  await page.mouse.down()
  await page.mouse.up()

  const comment = (await board(page)).annotations.at(-1)!
  await expect(page.getByTestId(`bloom-${comment.id}`)).toBeVisible()
  await expect(page.getByTestId(`bloom-${circle.id}`)).toHaveCount(0)

  await page.getByTestId('tool-select').click()
  await page.locator('.react-flow__pane').click({ position: { x: 12, y: 12 } })
  await expect(page.getByTestId('selected-annotation')).toHaveText('none selected')
  await page.getByTestId(`open-comment-${circle.id}`).click()
  await expect(page.getByTestId('selected-annotation')).toHaveAttribute('title', circle.id)
  await expect(page.getByTestId('selected-annotation')).toHaveText(/^#\d+$/)
  await expect(page.getByTestId(`bloom-${circle.id}`)).toBeVisible()
  await expect(page.getByTestId(`bloom-${comment.id}`)).toHaveCount(0)
})
