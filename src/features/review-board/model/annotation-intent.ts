import type { AnnotationIntent } from './board-document.schema'

// One-line meaning per intent. Shown to reviewers as chip tooltips and sent to
// agents so every adapter interprets the vocabulary the same way.
export const ANNOTATION_INTENT_GUIDANCE: Record<AnnotationIntent, string> = {
  bolder: 'Increase visual weight and confidence: stronger type, contrast, or presence.',
  quieter: 'Reduce visual noise: soften emphasis, remove competing accents.',
  distill: 'Remove everything non-essential; keep only what carries the message.',
  typeset: 'Fix typography: scale, rhythm, hierarchy, measure, and alignment.',
  layout: 'Rework spatial arrangement: grid, spacing, grouping, and flow.',
  colorize: 'Rework color: palette use, contrast, and semantic color roles.',
  animate: 'Add or refine motion: transitions, feedback, and micro-interactions.',
  delight: 'Add a small, tasteful moment of joy without hurting usability.',
  clarify: 'Make the purpose and next action obvious; improve copy and affordance.',
  harden: 'Handle edge states: long text, empty, loading, error, and overflow.',
}

export const ANNOTATION_INTENTS = Object.keys(ANNOTATION_INTENT_GUIDANCE) as AnnotationIntent[]
