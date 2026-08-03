export interface ExtractedAspectColorToken {
  name: string
  value: string
}

export interface ExtractedElementAspects {
  layout: {
    x: number
    y: number
    width: number
    height: number
    rotation: number
  }
  flex?: {
    direction: string
    gap: string
    padding: string
    align?: string
  }
  radius?: string
  fills: ExtractedAspectColorToken[]
  border?: {
    width: string
    color: ExtractedAspectColorToken
  }
  type?: {
    sizeLeading: string
    family: string
    weight: string
  }
}

export interface ExtractedFrameElement {
  id: string
  label: string
  role: string
  bounds: [[number, number], [number, number]]
  aspects?: ExtractedElementAspects
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
  const px = (value: number) => `${Math.round(value)}px`
  const tokenName = (kind: string, value: string) => {
    if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)') return kind
    if (kind === 'background') return 'card-bg'
    if (kind === 'color') return value.includes('oklch') ? 'ink-soft' : 'ink-strong'
    if (kind === 'border') return 'hairline'
    return kind
  }
  const colorToken = (kind: string, value: string) => ({ name: tokenName(kind, value), value })
  const aspectsFor = (element: Element, rect: DOMRect, style: CSSStyleDeclaration): ExtractedElementAspects => {
    const layout = {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
      rotation: 0,
    }
    const fills: ExtractedAspectColorToken[] = []
    if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      fills.push(colorToken('background', style.backgroundColor))
    }
    if (style.color) fills.push(colorToken('color', style.color))
    const flex = style.display.includes('flex')
      ? {
          direction: style.flexDirection || 'row',
          gap: style.gap && style.gap !== 'normal' ? style.gap : '0px',
          padding: `${style.paddingTop} / ${style.paddingLeft}`,
          align: style.alignItems || undefined,
        }
      : undefined
    const borderWidth = Number.parseFloat(style.borderTopWidth || '0')
    const border = borderWidth > 0
      ? {
          width: px(borderWidth),
          color: colorToken('border', style.borderTopColor || style.borderColor),
        }
      : undefined
    const fontSize = Number.parseFloat(style.fontSize || '16')
    const lineHeight = Number.parseFloat(style.lineHeight || '0')
    const leading = Number.isFinite(lineHeight) && lineHeight > 0
      ? Math.round(lineHeight)
      : Math.round(fontSize * 1.3)
    return {
      layout,
      flex,
      radius: style.borderRadius && style.borderRadius !== '0px' ? style.borderRadius : undefined,
      fills,
      border,
      type: {
        sizeLeading: `${Math.round(fontSize)} / ${leading}`,
        family: compact(style.fontFamily) || 'system-ui',
        weight: style.fontWeight || '400',
      },
    }
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
      aspects: aspectsFor(element, rect, style),
    })
  }
  return elements
}
