import type { TeachAnswer, TeachQuestion } from '../model/teach-question.schema'
import {
  HostTeachQuestionRequestSchema,
  readHostTeachQuestionMessage,
} from './host-teach-question-message.schema'
import { resolveWindowBoardHostBinding } from './host-board-load-provenance'

const TEACH_REQUEST_TIMEOUT_MS = 30_000

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

export function askTeachQuestionViaWindowHost(
  hostWindow: Window,
  question: TeachQuestion,
  options?: { allowedLoadOrigins?: readonly string[] },
): Promise<TeachAnswer> {
  const binding = resolveWindowBoardHostBinding(hostWindow, options?.allowedLoadOrigins)
  const requestId = crypto.randomUUID()
  const request = HostTeachQuestionRequestSchema.parse({
    type: 'design-review/ask-teach-question',
    schemaVersion: 1,
    requestId,
    question,
  })

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      hostWindow.removeEventListener('message', handleMessage)
      reject(new Error('The teach question timed out.'))
    }, TEACH_REQUEST_TIMEOUT_MS)

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== hostWindow.parent && event.source !== hostWindow.opener && event.source !== hostWindow) return
      const result = readHostTeachQuestionMessage(event.data)
      if (result.status === 'ignored' || result.requestId !== requestId) return
      hostWindow.removeEventListener('message', handleMessage)
      window.clearTimeout(timeout)
      if (result.status === 'failed') {
        reject(new Error(result.error))
        return
      }
      resolve(result.answer)
    }

    hostWindow.addEventListener('message', handleMessage)
    postToHostWindows(hostWindow, binding.requestBoardOrigins, request)
  })
}
