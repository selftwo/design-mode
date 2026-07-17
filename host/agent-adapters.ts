import { spawnSync } from 'node:child_process'
import type { AgentAvailability, AgentId } from '../src/features/local-host/host-api.schema.ts'
import { spawnEnvironment } from './spawn-environment.ts'

export interface AgentCommandSpec {
  executable: string
  args: string[]
  // 'stdin' pipes the prompt into the process; 'arg' substitutes it for the
  // {prompt} placeholder in args.
  promptVia: 'stdin' | 'arg'
}

// The review batch stays agent neutral; vendor-specific knowledge lives only
// here, behind one command spec per agent.
export const AGENT_COMMANDS: Record<AgentId, AgentCommandSpec> = {
  claude: {
    executable: 'claude',
    args: ['-p', '--permission-mode', 'acceptEdits'],
    promptVia: 'stdin',
  },
  codex: {
    executable: 'codex',
    args: ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', '-'],
    promptVia: 'stdin',
  },
  cursor: {
    executable: 'cursor-agent',
    args: ['-p', '{prompt}', '--force'],
    promptVia: 'arg',
  },
}

export function resolveAgentCommand(
  agent: AgentId,
  prompt: string,
  overrides?: Partial<Record<AgentId, AgentCommandSpec>>,
): { executable: string; args: string[]; stdin: string | null } {
  const spec = overrides?.[agent] ?? AGENT_COMMANDS[agent]
  if (spec.promptVia === 'arg') {
    return {
      executable: spec.executable,
      args: spec.args.map((arg) => (arg === '{prompt}' ? prompt : arg)),
      stdin: null,
    }
  }
  return { executable: spec.executable, args: spec.args, stdin: prompt }
}

export function probeAgentAvailability(
  overrides?: Partial<Record<AgentId, AgentCommandSpec>>,
): AgentAvailability[] {
  return (Object.keys(AGENT_COMMANDS) as AgentId[]).map((id) => {
    const executable = (overrides?.[id] ?? AGENT_COMMANDS[id]).executable
    const probe = spawnSync('which', [executable], { encoding: 'utf8', env: spawnEnvironment() })
    return { id, available: probe.status === 0 }
  })
}
