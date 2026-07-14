import {
  HOST_BOARD_MESSAGE_VERSION,
  HOST_BOARD_REQUEST_TYPE,
  HostBoardRequestSchema,
  readHostBoardLoadMessage,
  type HostBoardLoadResult,
} from './host-board-message.schema'
import {
  HostCaptureRefreshRequestSchema,
  HostLiveSessionRequestSchema,
  readHostCaptureRefreshMessage,
  readHostLiveSessionMessage,
  type HostCaptureRefreshResult,
  type HostLiveSessionResult,
} from './host-live-message.schema'
import {
  isTrustedHostBoardLoadMessage,
  resolveWindowBoardHostBinding,
} from './host-board-load-provenance'

export interface BoardHost {
  requestBoard(): void
  subscribe(listener: (result: HostBoardLoadResult) => void): () => void
  requestLiveSession(frameId: string, requestId: string): void
  subscribeLiveSession(listener: (result: HostLiveSessionResult) => void): () => void
  requestCaptureRefresh(frameId: string, requestId: string): void
  subscribeCaptureRefresh(listener: (result: HostCaptureRefreshResult) => void): () => void
}

export interface WindowBoardHostOptions {
  /** Origins permitted for inbound load-board messages (host parent, opener, or same-window fake host). */
  allowedLoadOrigins?: readonly string[]
}

function postToHostWindows(hostWindow: Window, requestBoardOrigins: readonly string[], payload: unknown) {
  hostWindow.postMessage(payload, hostWindow.location.origin)
  if (hostWindow.parent !== hostWindow) {
    for (const origin of requestBoardOrigins) {
      hostWindow.parent.postMessage(payload, origin)
    }
  }
  if (hostWindow.opener) {
    for (const origin of requestBoardOrigins) {
      hostWindow.opener.postMessage(payload, origin)
    }
  }
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
      postToHostWindows(hostWindow, binding.requestBoardOrigins, request)
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
    requestLiveSession(frameId, requestId) {
      const request = HostLiveSessionRequestSchema.parse({
        type: 'design-review/request-live-session',
        schemaVersion: 1,
        requestId,
        frameId,
      })
      postToHostWindows(hostWindow, binding.requestBoardOrigins, request)
    },
    subscribeLiveSession(listener) {
      const handleMessage = (event: MessageEvent) => {
        if (!isTrustedHostBoardLoadMessage(event, hostWindow, binding.allowedLoadOrigins)) return
        const result = readHostLiveSessionMessage(event.data)
        if (result.status !== 'ignored') listener(result)
      }
      hostWindow.addEventListener('message', handleMessage)
      return () => hostWindow.removeEventListener('message', handleMessage)
    },
    requestCaptureRefresh(frameId, requestId) {
      const request = HostCaptureRefreshRequestSchema.parse({
        type: 'design-review/request-capture-refresh',
        schemaVersion: 1,
        requestId,
        frameId,
      })
      postToHostWindows(hostWindow, binding.requestBoardOrigins, request)
    },
    subscribeCaptureRefresh(listener) {
      const handleMessage = (event: MessageEvent) => {
        if (!isTrustedHostBoardLoadMessage(event, hostWindow, binding.allowedLoadOrigins)) return
        const result = readHostCaptureRefreshMessage(event.data)
        if (result.status !== 'ignored') listener(result)
      }
      hostWindow.addEventListener('message', handleMessage)
      return () => hostWindow.removeEventListener('message', handleMessage)
    },
  }
}