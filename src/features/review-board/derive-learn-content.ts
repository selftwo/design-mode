import { deriveElementAspects } from './derive-element-aspects'
import type { FrameElement, ScreenFrame } from './model/board-document.schema'
import type { ElementAspects } from './model/element-aspects.schema'

export interface LearnContent {
  anatomy: string
  vocabularyTerm: string
  vocabularyDefinition: string
  whyLine: string
}

function isSolidSignalFill(aspects: ElementAspects): boolean {
  return aspects.fills.some((fill) => fill.name === 'ink-strong' || /^#(1c1c1c|000000|111|222)/i.test(fill.value))
}

function anatomyLines(element: FrameElement, aspects: ElementAspects): string[] {
  const lines: string[] = []
  if (aspects.flex) {
    lines.push(`${element.label} = flex ${aspects.flex.direction} · gap ${aspects.flex.gap}`)
  } else {
    lines.push(`${element.label} = ${element.role}`)
  }
  if (element.role === 'button') {
    lines.push(`  > ${element.label} (${isSolidSignalFill(aspects) ? 'solid fill' : 'control'})`)
  } else if (aspects.flex) {
    lines.push('  > content stack')
  } else if (/^h[1-6]$/.test(element.role) || element.role === 'heading') {
    lines.push('  > heading text')
  } else {
    lines.push(`  > ${element.role}`)
  }
  return lines
}

function vocabularyFor(element: FrameElement, aspects: ElementAspects): Pick<LearnContent, 'vocabularyTerm' | 'vocabularyDefinition' | 'whyLine'> {
  if (element.role === 'button' && isSolidSignalFill(aspects)) {
    return {
      vocabularyTerm: 'signal',
      vocabularyDefinition: 'the one saturated or solid element that draws the eye first.',
      whyLine: 'A filled control reads as the primary action because it is the only solid-ink block at this scale.',
    }
  }
  if (/^h[1-6]$/.test(element.role) || element.role === 'heading') {
    return {
      vocabularyTerm: 'hierarchy',
      vocabularyDefinition: 'type scale and weight that establish what to read first.',
      whyLine: 'Heading weight and size separate this block from body copy so the page reads in layers.',
    }
  }
  if (element.role === 'nav' || element.role === 'navigation') {
    return {
      vocabularyTerm: 'wayfinding',
      vocabularyDefinition: 'the links and labels that tell you where you can go.',
      whyLine: 'Navigation groups routes at the same visual level so the reviewer can compare destinations quickly.',
    }
  }
  if (element.role === 'aside') {
    return {
      vocabularyTerm: 'supporting surface',
      vocabularyDefinition: 'secondary content parked beside the main story.',
      whyLine: 'Aside placement keeps supporting detail visible without competing with the primary column.',
    }
  }
  if (aspects.border && aspects.flex) {
    return {
      vocabularyTerm: 'card',
      vocabularyDefinition: 'a bordered container that groups related content as one object.',
      whyLine: 'Shared border and padding turn separate lines into one scannable unit on the canvas.',
    }
  }
  if (element.role === 'link') {
    return {
      vocabularyTerm: 'affordance',
      vocabularyDefinition: 'visual cues that say this control can be activated.',
      whyLine: 'Link styling signals interactivity separate from static copy around it.',
    }
  }
  return {
    vocabularyTerm: element.role,
    vocabularyDefinition: `the extracted ${element.role} region the host captured on this screen.`,
    whyLine: 'Bounds and role come from the live capture, so the lens names what is on the page right now.',
  }
}

export function deriveLearnContent(element: FrameElement, frame: ScreenFrame): LearnContent {
  const aspects = deriveElementAspects(element, frame.viewport)
  const vocabulary = vocabularyFor(element, aspects)
  return {
    anatomy: anatomyLines(element, aspects).join('\n'),
    ...vocabulary,
  }
}
