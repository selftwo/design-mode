import os from 'node:os'
import path from 'node:path'

// The host may be launched from a GUI or supervisor with a bare system PATH.
// Dev servers and agent CLIs (npm, claude, codex, cursor-agent) usually live
// beside the running Node binary or in the common user install locations, so
// child processes get a PATH that can actually find them.
export function spawnEnvironment(): NodeJS.ProcessEnv {
  const current = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
  const extras = [
    path.dirname(process.execPath),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    path.join(os.homedir(), '.local', 'bin'),
  ]
  const merged = [...current, ...extras.filter((entry) => !current.includes(entry))]
  return { ...process.env, PATH: merged.join(path.delimiter) }
}
