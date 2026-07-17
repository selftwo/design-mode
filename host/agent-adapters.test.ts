import { describe, expect, it } from 'vitest'
import { resolveAgentCommand } from './agent-adapters.ts'

describe('resolveAgentCommand', () => {
  it('pipes the prompt to claude over stdin in non-interactive mode', () => {
    const command = resolveAgentCommand('claude', 'Apply the review')
    expect(command.executable).toBe('claude')
    expect(command.args).toContain('-p')
    expect(command.stdin).toBe('Apply the review')
  })

  it('pipes the prompt to codex exec with a writable sandbox', () => {
    const command = resolveAgentCommand('codex', 'Apply the review')
    expect(command.args[0]).toBe('exec')
    expect(command.args).toContain('--sandbox')
    expect(command.stdin).toBe('Apply the review')
  })

  it('substitutes the prompt into cursor-agent arguments', () => {
    const command = resolveAgentCommand('cursor', 'Apply the review')
    expect(command.executable).toBe('cursor-agent')
    expect(command.args).toContain('Apply the review')
    expect(command.stdin).toBeNull()
  })

  it('lets tests replace a vendor CLI with a local command', () => {
    const command = resolveAgentCommand('claude', 'prompt', {
      claude: { executable: 'node', args: ['-e', 'process.exit(0)'], promptVia: 'stdin' },
    })
    expect(command.executable).toBe('node')
  })
})
