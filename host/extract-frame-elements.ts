export interface ExtractedFrameElement {
  id: string
  label: string
  role: string
  bounds: [[number, number], [number, number]]
}

// Runs inside the captured page via Playwright evaluate, so it must stay
// self-contained: no imports, no captured scope. It breaks a page into the
// design elements a reviewer can pick on the canvas.
export function collectFrameElementsInPage(prefix: string): ExtractedFrameElement[] {
  const selectors = [
    'button', 'a[href]', 'input', 'select', 'textarea', 'table',
    '[role="button"]', '[role="tab"]', '[role="menuitem"]', '[role="dialog"]', '[role="listbox"]',
    'nav', 'aside', 'header', 'footer', 'h1', 'h2', 'h3',
  ].join(', ')
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const clamp = (value: number) => Math.min(1, Math.max(0, value))
  const compact = (text: string | null | undefined) => {
    const flat = (text ?? '').trim().replace(/\s+/g, ' ')
    return flat.length > 60 ? `${flat.slice(0, 57)}...` : flat
  }
  // Containers concatenate every child's text, so name them by kind and heading instead.
  const containerNames: Record<string, string> = {
    NAV: 'Navigation', ASIDE: 'Side pane', HEADER: 'Header', FOOTER: 'Footer', TABLE: 'Table',
  }
  const labelFor = (element: Element) => {
    const aria = compact(element.getAttribute('aria-label'))
    if (aria) return aria
    const containerName = containerNames[element.tagName]
      ?? (element.getAttribute('role') === 'dialog' ? 'Dialog' : null)
    if (containerName) {
      const heading = compact(element.querySelector('h1, h2, h3, [role="heading"]')?.textContent)
      return heading ? `${containerName}: ${heading}` : containerName
    }
    return compact(element.getAttribute('placeholder')) || compact(element.textContent) || element.tagName.toLowerCase()
  }
  const elements: ExtractedFrameElement[] = []
  let counter = 0
  for (const element of document.querySelectorAll(selectors)) {
    const rect = element.getBoundingClientRect()
    if (rect.width < 12 || rect.height < 10) continue
    if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= viewportWidth || rect.top >= viewportHeight) continue
    const style = getComputedStyle(element)
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue
    counter += 1
    elements.push({
      id: `${prefix}-el-${counter}`,
      label: labelFor(element),
      role: element.getAttribute('role') || element.tagName.toLowerCase(),
      bounds: [
        [clamp(rect.left / viewportWidth), clamp(rect.top / viewportHeight)],
        [clamp(rect.right / viewportWidth), clamp(rect.bottom / viewportHeight)],
      ],
    })
  }
  return elements
}
