export type LiveConnectionState = 'connecting' | 'ready' | 'unavailable'

export function createLiveReviewTerminalGuard() {
  let terminal = false
  let state: LiveConnectionState = 'connecting'

  return {
    getState: () => state,
    isTerminal: () => terminal,
    markReady: () => {
      if (terminal) return false
      terminal = true
      state = 'ready'
      return true
    },
    markUnavailable: () => {
      if (terminal) return false
      terminal = true
      state = 'unavailable'
      return true
    },
    reset: () => {
      terminal = false
      state = 'connecting'
    },
  }
}