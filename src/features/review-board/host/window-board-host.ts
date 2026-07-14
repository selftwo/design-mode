import {
  HOST_BOARD_MESSAGE_VERSION,
  HOST_BOARD_REQUEST_TYPE,
  HostBoardRequestSchema,
  readHostBoardLoadMessage,
  type HostBoardLoadResult,
} from './host-board-message.schema'
import {
  isTrustedHostBoardLoadMessage,
  resolveWindowBoardHostBinding,
} from './host-board-load-provenance'

export interface BoardHost {
  requestBoard(): void
  subscribe(listener: (result: HostBoardLoadResult) => void): () => void
}

export interface WindowBoardHostOptions {
  /** Origins permitted for inbound load-board messages (host parent, opener, or same-window fake host). */
  allowedLoadOrigins?: readonly string[]
}

export function createWindowBoardHost(
  hostWindow: Window = window,
  options?: WindowBoardHostOptions,
): BoardHost {
  const binding = resolveWindowBoardHostBinding(hostWindow, options?.allowedLoadOrigins)

  return {
    requestBoard() {
      const request = HostBoardRequestSchema.parse({
        type: HOST_BOARD_REQUEST_TYPE,
        schemaVersion: HOST_BOARD_MESSAGE_VERSION,
      })
      hostWindow.postMessage(request, hostWindow.location.origin)
      if (hostWindow.parent !== hostWindow) {
        for (const origin of binding.requestBoardOrigins) {
          hostWindow.parent.postMessage(request, origin)
        }
      }
      if (hostWindow.opener) {
        for (const origin of binding.requestBoardOrigins) {
          hostWindow.opener.postMessage(request, origin)
        }
      }
    },
    subscribe(listener) {
      const handleMessage = (event: MessageEvent) => {
        if (!isTrustedHostBoardLoadMessage(event, hostWindow, binding.allowedLoadOrigins)) return
        const result = readHostBoardLoadMessage(event.data)
        if (result.status !== 'ignored') listener(result)
      }
      hostWindow.addEventListener('message', handleMessage)
      return () => hostWindow.removeEventListener('message', handleMessage)
    },
  }
}