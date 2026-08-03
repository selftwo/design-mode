import type { AgentRun } from '@/features/local-host/host-api.schema'
import { bloomThreadStateWord } from '@/features/review-board/AnnotationBloom'
import { buildScopeChipLabel } from '@/features/review-board/build-scope-chip-label'
import { isAnnotationStale } from '@/features/review-board/model/is-annotation-stale'
import type { ReviewAnnotation, ScreenFrame } from '@/features/review-board/model/board-document.schema'
import type { ThreadReply } from '@/features/review-board/model/thread-reply.schema'
import { formatRelativeTime } from '@/features/m-web/format-relative-time'
import './ThreadHistory.css'

const AGENT_LABELS: Record<AgentRun['agent'], string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
}

function authorInitials(author: string): string {
  const parts = author.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'R'
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase()
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase()
}

function HumanReplyBlock({ reply }: { reply: ThreadReply }) {
  return (
    <div className="dm-thread-c" data-testid={`thread-reply-${reply.id}`}>
      <div className="dm-comment-head">
        <span className="dm-avatar dm-avatar--human" aria-hidden="true">{authorInitials(reply.author)}</span>
        <span className="dm-comment-author">{reply.author}</span>
        <span className="dm-comment-time">{formatRelativeTime(reply.createdAt)}</span>
      </div>
      <p className="dm-comment-body">{reply.body}</p>
    </div>
  )
}

function AgentReplyBlock({ run }: { run: AgentRun }) {
  const initials = AGENT_LABELS[run.agent].slice(0, 2).toUpperCase()
  const reply = run.outputTail.trim() || 'Patch staged.'
  return (
    <div className="dm-thread-c" data-testid="thread-agent-reply">
      <div className="dm-comment-head">
        <span className="dm-avatar dm-avatar--agent" aria-hidden="true">{initials}</span>
        <span className="dm-comment-author">{AGENT_LABELS[run.agent]}</span>
        <span className="dm-chip-candidate">Candidate</span>
        <span className="dm-comment-time">{formatRelativeTime(run.finishedAt ?? run.startedAt)}</span>
      </div>
      <p className="dm-comment-body">{reply}</p>
      <span className="dm-prov dm-mono">{`⌁ run ${run.id.slice(0, 8)}`}</span>
    </div>
  )
}

export function ThreadHistory({
  annotation,
  frame,
  frameAnnotations,
  agentRun,
  resolved = false,
  showRoutingFoot = true,
}: {
  annotation: ReviewAnnotation
  frame: ScreenFrame
  frameAnnotations: ReviewAnnotation[]
  agentRun: AgentRun | null
  resolved?: boolean
  showRoutingFoot?: boolean
}) {
  const stale = isAnnotationStale(annotation, frame)
  const scopeLabel = buildScopeChipLabel(annotation, frameAnnotations, stale)
  const stateWord = bloomThreadStateWord(annotation, resolved, stale)
  const replies: ThreadReply[] = annotation.replies ?? []
  const showAgentReply = agentRun?.status === 'done' && !stale
  const instruction = annotation.instruction.trim()

  return (
    <div className="dm-thread" data-testid={`thread-${annotation.id}`}>
      <div className="dm-thread-head">
        <span className={`dm-thread-state ${stateWord === 'open' ? 'dm-thread-state--open' : ''}`}>
          {stateWord}
        </span>
        <span className="dm-mono">on {frame.label}</span>
        <span className={`dm-scope-chip ${stale ? '' : 'dm-scope-chip--live'}`}>{scopeLabel}</span>
      </div>

      {instruction ? (
        <div className="dm-thread-c" data-testid="thread-original-comment">
          <div className="dm-comment-head">
            <span className="dm-avatar dm-avatar--human" aria-hidden="true">R</span>
            <span className="dm-comment-author">Reviewer</span>
            <span className="dm-comment-time">{formatRelativeTime(annotation.createdAt)}</span>
          </div>
          <p className="dm-comment-body">{instruction}</p>
          {annotation.intent ? (
            <div className="dm-chip-row" role="group" aria-label="Intent">
              <span className="dm-scope-chip dm-scope-chip--live">{annotation.intent}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {replies.map((reply) => <HumanReplyBlock key={reply.id} reply={reply} />)}
      {showAgentReply && agentRun ? <AgentReplyBlock run={agentRun} /> : null}

      {showRoutingFoot ? (
        stale ? (
          <div className="dm-thread-foot" data-testid="thread-stale-foot">
            {`made against rev ${annotation.madeAgainstRevision} · anchor is approximate`}
          </div>
        ) : agentRun?.status === 'done' ? (
          <div className="dm-thread-foot dm-thread-foot--returned" data-testid="thread-routing-foot">
            <span className="dm-rdot" data-r="returned" aria-hidden="true" />
            returned · patch staged
          </div>
        ) : null
      ) : null}
    </div>
  )
}
