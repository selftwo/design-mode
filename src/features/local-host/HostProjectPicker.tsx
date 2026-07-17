import { useEffect, useState, type FormEvent } from 'react'
import type { LocalHostClient } from './local-host-client'
import type { Project, ProjectRoute } from './host-api.schema'
import './HostProjectPicker.css'

// One route per line: "/path Label after the path". The id comes from the path.
export function parseRouteLines(text: string): ProjectRoute[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('/'))
    .map((line) => {
      const [path, ...labelParts] = line.split(/\s+/)
      const slug = path!.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'root'
      return {
        id: slug.toLowerCase(),
        label: labelParts.join(' ') || (path === '/' ? 'Home' : path!),
        path: path!,
      }
    })
}

export function HostProjectPicker({ client }: { client: LocalHostClient }) {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [capturingId, setCapturingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [devCommand, setDevCommand] = useState('npm run dev')
  const [devPort, setDevPort] = useState('5173')
  const [routesText, setRoutesText] = useState('/ Home')

  useEffect(() => {
    client.listProjects().then(setProjects).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'Projects could not be loaded.')
    })
  }, [client])

  const openBoard = (projectId: string) => {
    window.location.search = `?project=${projectId}`
  }

  const capture = async (projectId: string) => {
    setError(null)
    setCapturingId(projectId)
    try {
      await client.captureProject(projectId)
      openBoard(projectId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The capture failed.')
      setCapturingId(null)
    }
  }

  const register = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    const routes = parseRouteLines(routesText)
    if (routes.length === 0) {
      setError('List at least one route, one per line, starting with "/".')
      return
    }
    try {
      const project = await client.registerProject({
        name: name.trim(),
        path: path.trim(),
        devCommand: devCommand.trim(),
        devPort: Number(devPort),
        routes,
      })
      setProjects((current) => [...(current ?? []), project])
      setName('')
      setPath('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The project could not be registered.')
    }
  }

  return (
    <main className="project-picker" data-testid="project-picker">
      <section className="picker-column">
        <h1>Review a project</h1>
        <p className="picker-hint">
          Pick a registered project to open its board, or capture it again to pull fresh screens.
        </p>
        {projects === null ? <p className="picker-hint">Loading projects…</p> : null}
        {projects !== null && projects.length === 0 ? (
          <p className="picker-hint" data-testid="picker-empty">No projects yet. Register one on the right.</p>
        ) : null}
        <ul className="picker-projects">
          {(projects ?? []).map((project) => (
            <li key={project.id} data-testid={`picker-project-${project.id}`}>
              <div className="picker-project-text">
                <strong>{project.name}</strong>
                <span>{project.path}</span>
                <span>{project.routes.length} route{project.routes.length === 1 ? '' : 's'} · port {project.devPort}</span>
              </div>
              <div className="picker-project-actions">
                <button type="button" onClick={() => openBoard(project.id)} data-testid={`open-project-${project.id}`}>
                  Open board
                </button>
                <button
                  type="button"
                  disabled={capturingId !== null}
                  onClick={() => void capture(project.id)}
                  data-testid={`capture-project-${project.id}`}
                >
                  {capturingId === project.id ? 'Capturing…' : 'Capture screens'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="picker-column">
        <h2>Register a project</h2>
        <form className="picker-form" onSubmit={(event) => void register(event)}>
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} required data-testid="project-name" />
          </label>
          <label>
            Absolute path
            <input value={path} onChange={(event) => setPath(event.target.value)} required placeholder="/Users/you/code/app" data-testid="project-path" />
          </label>
          <label>
            Dev command
            <input value={devCommand} onChange={(event) => setDevCommand(event.target.value)} required data-testid="project-dev-command" />
          </label>
          <label>
            Dev port
            <input value={devPort} onChange={(event) => setDevPort(event.target.value)} required inputMode="numeric" data-testid="project-dev-port" />
          </label>
          <label>
            Routes to capture (one per line: /path Label)
            <textarea value={routesText} onChange={(event) => setRoutesText(event.target.value)} rows={4} data-testid="project-routes" />
          </label>
          <button type="submit" data-testid="register-project">Register project</button>
        </form>
        {error ? <p role="alert" className="picker-error" data-testid="picker-error">{error}</p> : null}
      </section>
    </main>
  )
}
