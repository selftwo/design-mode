import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AgentRun } from '@/features/local-host/host-api.schema'
import { bloomThreadStateWord } from '@/features/review-board/AnnotationBloom'
import { isReviewAnnotation } from '@/features/review-board/is-board-annotation'
import { isAnnotationResolved } from '@/features/review-board/is-annotation-resolved'
import { isAnnotationStale } from '@/features/review-board/model/is-annotation-stale'
import { isInstructionIncomplete } from '@/features/review-board/model/annotation-instruction'
import type { BoardDocument, ReviewAnnotation, ScreenFrame } from '@/features/review-board/model/board-document.schema'
import { ThreadHistory } from '@/features/review-board/ThreadHistory'
import type { MWebClient } from './create-m-web-client'
import { buildMWebHref, type MWebRoute } from './MWebApp'

function frameMeta(frame: ScreenFrame): string {
  return `${frame.label} · ${frame.route || '/'} · ${frame.viewport.width} · rev ${frame.revision}`
}

function reviewAnnotationsForFrame(board: BoardDocument, frameId: string): ReviewAnnotation[] {
  return board.annotations.filter((item) => item.frameId === frameId).filter(isReviewAnnotation)
}

function agentRunForAnnotation(runs: AgentRun[], annotationId: string): AgentRun | null {
  return runs.find((run) => run.status === 'done' && run.annotationIds.includes(annotationId)) ?? null
}

function jumpLabel(annotation: ReviewAnnotation, frameAnnotations: ReviewAnnotation[], frame: ScreenFrame): string {
  const ordinal = frameAnnotations.indexOf(annotation) + 1
  const stale = isAnnotationStale(annotation, frame)
  const draft = isInstructionIncomplete(annotation.instruction)
  const resolved = isAnnotationResolved(annotation)
  const state = bloomThreadStateWord(annotation, resolved, stale)
  const intent = annotation.intent ? `${annotation.intent} · ` : ''
  if (stale) return `#${ordinal} ${intent}stale`
  if (draft) return `#${ordinal} draft`
  return `#${ordinal} ${intent}${state}`
}

export function MWebCapturePage({
  client,
  runs,
  route,
  navigate,
}: {
  client: MWebClient
  runs: AgentRun[]
  route: Extract<MWebRoute, { page: 'capture' }>
  navigate: (route: MWebRoute) => void
}) {
  const [board, setBoard] = useState<BoardDocument | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [replyError, setReplyError] = useState<string | null>(null)
  const [savingReply, setSavingReply] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [savingApprove, setSavingApprove] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(Boolean(route.annotationId))

  const loadBoard = useCallback(async () => {
    try {
      const loaded = await client.loadBoard(route.projectId)
      setBoard(loaded)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The board could not be loaded.')
    }
  }, [client, route.projectId])

  useEffect(() => {
    void loadBoard()
  }, [loadBoard])

  useEffect(() => {
    return client.subscribeHostEvents((event) => {
      if (event.type === 'board-updated' && event.projectId === route.projectId) {
        void loadBoard()
      }
    })
  }, [client, loadBoard, route.projectId])

  useEffect(() => {
    setSheetOpen(Boolean(route.annotationId))
  }, [route.annotationId])

  const frame = useMemo(() => {
    if (!board) return null
    const frameId = route.frameId ?? board.frames[0]?.id
    return board.frames.find((item) => item.id === frameId) ?? board.frames[0] ?? null
  }, [board, route.frameId])

  const frameAnnotations = useMemo(
    () => (board && frame ? reviewAnnotationsForFrame(board, frame.id) : []),
    [board, frame],
  )

  const selectedAnnotation = useMemo(() => {
    if (!route.annotationId) return frameAnnotations[0] ?? null
    return frameAnnotations.find((item) => item.id === route.annotationId) ?? frameAnnotations[0] ?? null
  }, [frameAnnotations, route.annotationId])

  const openThread = (annotationId: string) => {
    if (!frame) return
    navigate({
      page: 'capture',
      projectId: route.projectId,
      frameId: frame.id,
      annotationId,
    })
    setSheetOpen(true)
  }

  const closeThread = () => {
    if (!frame) return
    navigate({ page: 'capture', projectId: route.projectId, frameId: frame.id })
    setSheetOpen(false)
  }

  const submitReply = async () => {
    if (!selectedAnnotation || !replyDraft.trim()) return
    setSavingReply(true)
    setReplyError(null)
    try {
      const next = await client.replyToThread(route.projectId, selectedAnnotation.id, replyDraft)
      setBoard(next)
      setReplyDraft('')
    } catch (cause) {
      setReplyError(cause instanceof Error ? cause.message : 'Reply not sent.')
    } finally {
      setSavingReply(false)
    }
  }

  const submitApprove = async () => {
    if (!selectedAnnotation) return
    setSavingApprove(true)
    setApproveError(null)
    try {
      const next = await client.resolveAnnotation(route.projectId, selectedAnnotation.id)
      setBoard(next)
    } catch (cause) {
      setApproveError(cause instanceof Error ? cause.message : 'Approval not saved.')
    } finally {
      setSavingApprove(false)
    }
  }

  if (!board || !frame) {
    return (
      <div className="mw-page mw-page--capture" data-testid="mweb-capture-page">
        {error ? <p className="dm-notice" data-tone="error" role="alert">{error}</p> : <p className="mw-sub">Loading capture…</p>}
      </div>
    )
  }

  const selectedAgentRun = selectedAnnotation ? agentRunForAnnotation(runs, selectedAnnotation.id) : null
  const markCount = frameAnnotations.length
  const selectedResolved = selectedAnnotation ? isAnnotationResolved(selectedAnnotation) : false
  const selectedStale = selectedAnnotation ? isAnnotationStale(selectedAnnotation, frame) : false
  const canApprove = Boolean(
    selectedAnnotation
    && selectedAgentRun?.status === 'done'
    && !selectedStale
    && !selectedResolved,
  )

  return (
    <div className={`mw-page mw-page--capture ${sheetOpen ? 'mw-page--thread-open' : ''}`} data-testid="mweb-capture-page">
      <header className="mw-top mw-top--row">
        <button
          type="button"
          className="mw-back"
          onClick={() => navigate({ page: 'boards' })}
        >
          ‹ Boards
        </button>
        <span className="dm-mono">{frameMeta(frame)}</span>
        <button
          type="button"
          className="mw-back"
          onClick={() => navigate({ page: 'runs', projectId: route.projectId })}
        >
          Activity ›
        </button>
      </header>

      {error ? <p className="dm-notice" data-tone="error" role="alert">{error}</p> : null}

      <figure className="mw-capture">
        <span className="dm-frame-label mw-frame-label">{frame.label}</span>
        <img className="mw-capture-image dm-frame" src={frame.screenshotDataUrl} alt={frame.label} />
        {frameAnnotations.map((annotation, index) => {
          const [x, y] = annotation.anchor
          return (
            <button
              key={annotation.id}
              type="button"
              className="mw-mark"
              style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
              aria-label={`Annotation ${index + 1} on ${frame.label}`}
              aria-expanded={selectedAnnotation?.id === annotation.id && sheetOpen}
              onClick={() => openThread(annotation.id)}
            >
              <span className="dm-mark-circle"><span className="dm-mark-num">{index + 1}</span></span>
            </button>
          )
        })}
      </figure>

      <p className="mw-meta">
        {markCount} mark{markCount === 1 ? '' : 's'} on this capture · threads for the whole board sit below
      </p>

      {sheetOpen && selectedAnnotation ? (
        <button type="button" className="mw-veil" aria-label="Close thread and return to the capture" onClick={closeThread} />
      ) : null}

      <section
        className={`mw-sheet ${sheetOpen ? 'mw-sheet--open' : ''}`}
        data-open={sheetOpen ? 'true' : 'false'}
        aria-label="Annotation threads"
        data-testid="mweb-thread-sheet"
      >
        <button
          type="button"
          className="mw-handle"
          aria-expanded={sheetOpen}
          aria-label={sheetOpen ? 'Close thread' : 'Open annotation thread'}
          onClick={() => (sheetOpen ? closeThread() : setSheetOpen(true))}
        >
          <span className="mw-handle-bar" aria-hidden="true" />
        </button>
        <div className="mw-chips">
          {frameAnnotations.map((annotation) => {
            const stale = isAnnotationStale(annotation, frame)
            const live = !stale && !isInstructionIncomplete(annotation.instruction)
            return (
              <button
                key={annotation.id}
                type="button"
                className={`mw-jump ${live ? 'mw-jump--live' : ''} ${stale ? 'mw-jump--stale' : ''}`}
                aria-expanded={selectedAnnotation?.id === annotation.id && sheetOpen}
                onClick={() => openThread(annotation.id)}
              >
                {jumpLabel(annotation, frameAnnotations, frame)}
              </button>
            )
          })}
        </div>
        {sheetOpen && selectedAnnotation ? (
          <div className="mw-sheet-body" id="mweb-sheet-body">
            <ThreadHistory
              annotation={selectedAnnotation}
              frame={frame}
              frameAnnotations={frameAnnotations}
              agentRun={selectedAgentRun}
              resolved={selectedResolved}
            />
            <textarea
              className="dm-textarea"
              placeholder="Reply to this thread"
              aria-label="Reply to this thread"
              data-testid="mweb-reply-input"
              value={replyDraft}
              onChange={(event) => setReplyDraft(event.target.value)}
            />
            {replyError ? (
              <p className="dm-notice" data-tone="error" role="alert" data-testid="mweb-reply-error">{replyError}</p>
            ) : null}
            {approveError ? (
              <p className="dm-notice" data-tone="error" role="alert" data-testid="mweb-approve-error">{approveError}</p>
            ) : null}
            <div className="mw-actions">
              <button
                type="button"
                className="dm-btn"
                data-testid="mweb-reply-submit"
                disabled={savingReply || !replyDraft.trim()}
                onClick={() => { void submitReply() }}
              >
                Reply
              </button>
              <button
                type="button"
                className="dm-btn dm-btn--primary"
                data-testid="mweb-approve-submit"
                disabled={savingApprove || !canApprove}
                aria-disabled={!canApprove}
                onClick={() => { void submitApprove() }}
              >
                Approve change
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
