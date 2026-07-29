import { describe, expect, it } from 'vitest'
import type { AgentRun, AgentRunStatus } from './host-api.schema'
import {
  LEARN_ANSWER_TIMEOUT_MS,
  addPendingLearn,
  expiredLearnRequestIds,
  failedLearnRequestIds,
  hasPendingLearn,
  removePendingLearn,
  unanswerableLearnRequestIds,
  type PendingLearnRequest,
} from './pending-learn-requests'

function ask(requestId: string, runId: string, askedAtMs = 0): PendingLearnRequest {
  return { requestId, runId, askedAtMs }
}

function run(id: string, status: AgentRunStatus): AgentRun {
  return { id, projectId: 'p', agent: 'claude', status, annotationIds: [], startedAt: new Date(0).toISOString(), outputTail: '' }
}

describe('addPendingLearn / removePendingLearn / hasPendingLearn', () => {
  it('adds a request and finds it by request id', () => {
    const pending = addPendingLearn([], ask('req-1', 'run-1'))
    expect(hasPendingLearn(pending, 'req-1')).toBe(true)
    expect(hasPendingLearn(pending, 'req-2')).toBe(false)
  })

  it('replaces an existing entry with the same request id instead of duplicating it', () => {
    const pending = addPendingLearn(addPendingLearn([], ask('req-1', 'run-1')), ask('req-1', 'run-2'))
    expect(pending).toEqual([ask('req-1', 'run-2')])
  })

  it('removes only the named requests', () => {
    const pending = [ask('req-1', 'run-1'), ask('req-2', 'run-2'), ask('req-3', 'run-3')]
    expect(removePendingLearn(pending, ['req-1', 'req-3'])).toEqual([ask('req-2', 'run-2')])
  })

  it('never mutates the input list', () => {
    const pending = [ask('req-1', 'run-1')]
    addPendingLearn(pending, ask('req-2', 'run-2'))
    removePendingLearn(pending, ['req-1'])
    expect(pending).toEqual([ask('req-1', 'run-1')])
  })
})

describe('failedLearnRequestIds', () => {
  it('releases the requests tied to a failed run', () => {
    const pending = [ask('req-1', 'run-1'), ask('req-2', 'run-2')]
    expect(failedLearnRequestIds(pending, run('run-1', 'failed'))).toEqual(['req-1'])
  })

  it('keeps waiting while the run is queued, running, or done', () => {
    const pending = [ask('req-1', 'run-1')]
    expect(failedLearnRequestIds(pending, run('run-1', 'queued'))).toEqual([])
    expect(failedLearnRequestIds(pending, run('run-1', 'running'))).toEqual([])
    // A done run lands its answer over board-patched; the run-updated event
    // must not release the request ahead of the answer.
    expect(failedLearnRequestIds(pending, run('run-1', 'done'))).toEqual([])
  })

  it('ignores a failed run no pending request is tied to', () => {
    expect(failedLearnRequestIds([ask('req-1', 'run-1')], run('run-9', 'failed'))).toEqual([])
  })
})

describe('unanswerableLearnRequestIds', () => {
  it('releases requests whose run is missing from the resynced list', () => {
    const pending = [ask('req-1', 'run-gone'), ask('req-2', 'run-2')]
    expect(unanswerableLearnRequestIds(pending, [run('run-2', 'running')])).toEqual(['req-1'])
  })

  it('releases requests whose run already finished, because the missed patch event will not be resent', () => {
    const pending = [ask('req-1', 'run-1'), ask('req-2', 'run-2')]
    const runs = [run('run-1', 'done'), run('run-2', 'failed')]
    expect(unanswerableLearnRequestIds(pending, runs)).toEqual(['req-1', 'req-2'])
  })

  it('keeps requests whose run is still queued or running', () => {
    const pending = [ask('req-1', 'run-1'), ask('req-2', 'run-2')]
    const runs = [run('run-1', 'queued'), run('run-2', 'running')]
    expect(unanswerableLearnRequestIds(pending, runs)).toEqual([])
  })
})

describe('expiredLearnRequestIds', () => {
  it('releases a request once it reaches the timeout and keeps younger ones', () => {
    const pending = [ask('req-old', 'run-1', 0), ask('req-new', 'run-2', 1)]
    expect(expiredLearnRequestIds(pending, LEARN_ANSWER_TIMEOUT_MS)).toEqual(['req-old'])
  })

  it('releases nothing before the timeout', () => {
    const pending = [ask('req-1', 'run-1', 0)]
    expect(expiredLearnRequestIds(pending, LEARN_ANSWER_TIMEOUT_MS - 1)).toEqual([])
  })
})
