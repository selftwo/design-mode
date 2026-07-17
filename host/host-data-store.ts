import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { BoardDocumentSchema, type BoardDocument } from '../src/features/review-board/model/board-document.schema.ts'
import {
  AgentRunSchema,
  ProjectSchema,
  type AgentRun,
  type Project,
  type ProjectRegistration,
} from '../src/features/local-host/host-api.schema.ts'

const ProjectRegistrySchema = z.array(ProjectSchema)

export function defaultDataDir(): string {
  return process.env.DESIGN_MODE_HOME ?? path.join(os.homedir(), '.design-mode')
}

function readJsonFile<Schema extends z.ZodTypeAny>(file: string, schema: Schema): z.output<Schema> | null {
  if (!existsSync(file)) return null
  return schema.parse(JSON.parse(readFileSync(file, 'utf8'))) as z.output<Schema>
}

function writeJsonFile(file: string, value: unknown) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value, null, 2))
}

function projectIdFrom(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `${slug || 'project'}-${randomUUID().slice(0, 8)}`
}

// One directory owns everything the host knows: registered projects, their
// boards, and the journal of agent runs. Everything read back is re-validated.
export function createHostDataStore(dataDir: string = defaultDataDir()) {
  mkdirSync(dataDir, { recursive: true })
  const projectsFile = path.join(dataDir, 'projects.json')
  const boardFile = (projectId: string) => path.join(dataDir, 'boards', `${projectId}.json`)
  const runDir = (runId: string) => path.join(dataDir, 'runs', runId)
  const runFile = (runId: string) => path.join(runDir(runId), 'run.json')

  return {
    dataDir,

    listProjects(): Project[] {
      return readJsonFile(projectsFile, ProjectRegistrySchema) ?? []
    },

    getProject(projectId: string): Project | null {
      return this.listProjects().find((project) => project.id === projectId) ?? null
    },

    registerProject(registration: ProjectRegistration): Project {
      const project = ProjectSchema.parse({
        ...registration,
        id: projectIdFrom(registration.name),
        registeredAt: new Date().toISOString(),
      })
      writeJsonFile(projectsFile, [...this.listProjects(), project])
      return project
    },

    removeProject(projectId: string) {
      writeJsonFile(projectsFile, this.listProjects().filter((project) => project.id !== projectId))
      rmSync(boardFile(projectId), { force: true })
    },

    readBoard(projectId: string): BoardDocument | null {
      return readJsonFile(boardFile(projectId), BoardDocumentSchema)
    },

    writeBoard(projectId: string, board: BoardDocument) {
      writeJsonFile(boardFile(projectId), BoardDocumentSchema.parse(board))
    },

    listRuns(): AgentRun[] {
      const dir = path.join(dataDir, 'runs')
      if (!existsSync(dir)) return []
      return readdirSync(dir)
        .map((entry) => readJsonFile(runFile(entry), AgentRunSchema))
        .filter((run): run is AgentRun => run !== null)
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    },

    writeRun(run: AgentRun) {
      writeJsonFile(runFile(run.id), AgentRunSchema.parse(run))
    },

    runAssetDir(runId: string): string {
      const dir = runDir(runId)
      mkdirSync(dir, { recursive: true })
      return dir
    },
  }
}

export type HostDataStore = ReturnType<typeof createHostDataStore>
