import { buildMWebHref, type MWebRoute } from './MWebApp'

export function MWebNoticesPage({ navigate }: { navigate: (route: MWebRoute) => void }) {
  return (
    <div className="mw-page" data-testid="mweb-notices-page">
      <header className="mw-top">
        <div>
          <h1 className="mw-title">Notices</h1>
          <p className="mw-sub">Every banner, stale treatment, and empty state on the one notice shape.</p>
        </div>
        <button type="button" className="mw-back" onClick={() => navigate({ page: 'boards' })}>
          ‹ Boards
        </button>
      </header>

      <section className="mw-spec">
        <h2 className="mw-sect">Stale · board advanced</h2>
        <div className="dm-notice" data-tone="warn" role="status">
          <span>Board advanced. Annotation #2 is stale.</span>
          <button type="button" className="dm-notice-action">Review</button>
          <button type="button" className="dm-notice-dismiss" aria-label="Dismiss">✕</button>
        </div>
        <div className="mw-stale-row">
          <div className="mw-stale-head">
            <span className="dm-thread-state">✓ Resolved</span>
            <span className="dm-mono">on Pricing · /pricing</span>
            <span className="dm-scope-chip">▢ element · stale</span>
          </div>
          <p className="dm-comment-body">Both plans read the same weight. The paid one should feel like the object.</p>
          <span className="mw-stale-note">made against rev 1 · anchor is approximate</span>
        </div>
      </section>

      <section className="mw-spec">
        <h2 className="mw-sect">Reload · run finished</h2>
        <div className="dm-notice" data-tone="success" role="status">
          <span>Run r-142 finished. Reload the board to see the change.</span>
          <button type="button" className="dm-notice-action">Reload</button>
          <button type="button" className="dm-notice-dismiss" aria-label="Dismiss">✕</button>
        </div>
      </section>

      <section className="mw-spec">
        <h2 className="mw-sect">Error · agent unreachable</h2>
        <div className="dm-notice" data-tone="error" role="alert">
          <span>Reply not sent. The agent host is unreachable.</span>
          <button type="button" className="dm-notice-action">Retry</button>
          <button type="button" className="dm-notice-dismiss" aria-label="Dismiss">✕</button>
        </div>
      </section>

      <section className="mw-spec">
        <h2 className="mw-sect">Empty · no threads</h2>
        <div className="mw-empty">
          <p className="mw-empty-title">No open threads</p>
          <p className="mw-empty-line">Marks made on the desktop canvas appear here when a review starts.</p>
        </div>
      </section>

      <section className="mw-spec">
        <h2 className="mw-sect">Empty · no runs</h2>
        <div className="mw-empty">
          <p className="mw-empty-title">No runs yet</p>
          <p className="mw-empty-line">Dispatched work shows up here while agents are on it.</p>
        </div>
      </section>

      <a className="mw-back" href={buildMWebHref({ page: 'boards' })} onClick={(event) => {
        event.preventDefault()
        navigate({ page: 'boards' })
      }}
      >
        Back to boards
      </a>
    </div>
  )
}
