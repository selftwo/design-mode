import { describe, expect, it } from 'vitest'
import { isInstructionIncomplete } from './annotation-instruction'

describe('annotation instruction drafts', () => {
  it('treats whitespace-only text as incomplete', () => {
    expect(isInstructionIncomplete('')).toBe(true)
    expect(isInstructionIncomplete('   \n\t  ')).toBe(true)
  })

  it('treats non-empty trimmed text as complete enough to edit', () => {
    expect(isInstructionIncomplete('Check contrast')).toBe(false)
    expect(isInstructionIncomplete('  spacing  ')).toBe(false)
  })
})