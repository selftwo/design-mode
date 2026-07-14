import { z } from 'zod'
import { PostMessageOriginSchema } from './post-message-origin.schema'

export const HOST_LIVE_MESSAGE_VERSION = 1 as const

export const HOST_LIVE_SESSION_REQUEST_TYPE = 'design-review/request-live-session' as const
export const HOST_LIVE_SESSION_TYPE = 'design-review/live-session' as const
export const HOST_LIVE_SESSION_REJECTED_TYPE = 'design-review/live-session-rejected' as const

export const HOST_CAPTURE_REFRESH_REQUEST_TYPE = 'design-review/request-capture-refresh' as const
export const HOST_CAPTURE_REFRESH_SUCCESS_TYPE = 'design-review/capture-refresh-success' as const
export const HOST_CAPTURE_REFRESH_FAILURE_TYPE = 'design-review/capture-refresh-failure' as const

export const HostLiveSessionRequestSchema = z.object({
  type: z.literal(HOST_LIVE_SESSION_REQUEST_TYPE),
  schemaVersion: z.literal(HOST_LIVE_MESSAGE_VERSION),
  requestId: z.string().uuid(),
  frameId: z.string().min(1),
})

export const HostLiveSessionSchema = z.object({
  type: z.literal(HOST_LIVE_SESSION_TYPE),
  schemaVersion: z.literal(HOST_LIVE_MESSAGE_VERSION),
  requestId: z.string().uuid(),
  frameId: z.string().min(1),
  liveUrl: z.string().url(),
  allowedOrigin: PostMessageOriginSchema,
  focusToken: z.string().uuid(),
})

export const HostLiveSessionRejectedSchema = z.object({
  type: z.literal(HOST_LIVE_SESSION_REJECTED_TYPE),
  schemaVersion: z.literal(HOST_LIVE_MESSAGE_VERSION),
  requestId: z.string().uuid(),
  frameId: z.string().min(1),
  error: z.string().min(1),
})

export const HostCaptureRefreshRequestSchema = z.object({
  type: z.literal(HOST_CAPTURE_REFRESH_REQUEST_TYPE),
  schemaVersion: z.literal(HOST_LIVE_MESSAGE_VERSION),
  requestId: z.string().uuid(),
  frameId: z.string().min(1),
})

export const HostCaptureRefreshSuccessSchema = z.object({
  type: z.literal(HOST_CAPTURE_REFRESH_SUCCESS_TYPE),
  schemaVersion: z.literal(HOST_LIVE_MESSAGE_VERSION),
  requestId: z.string().uuid(),
  frameId: z.string().min(1),
  screenshotPath: z.string().min(1),
  screenshotDataUrl: z.string().min(1),
  refreshedScreenshotDataUrl: z.string().min(1),
  captureHash: z.string().min(1),
})

export const HostCaptureRefreshFailureSchema = z.object({
  type: z.literal(HOST_CAPTURE_REFRESH_FAILURE_TYPE),
  schemaVersion: z.literal(HOST_LIVE_MESSAGE_VERSION),
  requestId: z.string().uuid(),
  frameId: z.string().min(1),
  error: z.string().min(1),
})

export type HostLiveSessionRequest = z.infer<typeof HostLiveSessionRequestSchema>
export type HostLiveSessionPayload = z.infer<typeof HostLiveSessionSchema>
export type HostCaptureRefreshSuccessPayload = z.infer<typeof HostCaptureRefreshSuccessSchema>

export type HostLiveSessionResult =
  | { status: 'ready'; requestId: string; frameId: string; liveUrl: string; allowedOrigin: string; focusToken: string }
  | { status: 'rejected'; requestId: string; frameId: string; error: string }
  | { status: 'ignored' }

export type HostCaptureRefreshResult =
  | {
    status: 'refreshed'
    requestId: string
    frameId: string
    screenshotPath: string
    screenshotDataUrl: string
    refreshedScreenshotDataUrl: string
    captureHash: string
  }
  | { status: 'failed'; requestId: string; frameId: string; error: string }
  | { status: 'ignored' }

function formatIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || 'message'}: ${issue.message}`)
    .join('; ')
}

export function readHostLiveSessionMessage(value: unknown): HostLiveSessionResult {
  if (!value || typeof value !== 'object' || !('type' in value)) return { status: 'ignored' }
  const type = value.type
  if (type === HOST_LIVE_SESSION_REJECTED_TYPE) {
    const parsed = HostLiveSessionRejectedSchema.safeParse(value)
    if (!parsed.success) return { status: 'ignored' }
    return {
      status: 'rejected',
      requestId: parsed.data.requestId,
      frameId: parsed.data.frameId,
      error: parsed.data.error,
    }
  }
  if (type !== HOST_LIVE_SESSION_TYPE) return { status: 'ignored' }
  const parsed = HostLiveSessionSchema.safeParse(value)
  if (!parsed.success) return { status: 'ignored' }
  if (parsed.data.schemaVersion !== HOST_LIVE_MESSAGE_VERSION) return { status: 'ignored' }
  return {
    status: 'ready',
    requestId: parsed.data.requestId,
    frameId: parsed.data.frameId,
    liveUrl: parsed.data.liveUrl,
    allowedOrigin: parsed.data.allowedOrigin,
    focusToken: parsed.data.focusToken,
  }
}

export function readHostCaptureRefreshMessage(value: unknown): HostCaptureRefreshResult {
  if (!value || typeof value !== 'object' || !('type' in value)) return { status: 'ignored' }
  const type = value.type
  if (type === HOST_CAPTURE_REFRESH_FAILURE_TYPE) {
    const parsed = HostCaptureRefreshFailureSchema.safeParse(value)
    if (!parsed.success) return { status: 'ignored' }
    return {
      status: 'failed',
      requestId: parsed.data.requestId,
      frameId: parsed.data.frameId,
      error: parsed.data.error,
    }
  }
  if (type !== HOST_CAPTURE_REFRESH_SUCCESS_TYPE) return { status: 'ignored' }
  const parsed = HostCaptureRefreshSuccessSchema.safeParse(value)
  if (!parsed.success) return { status: 'ignored' }
  return {
    status: 'refreshed',
    requestId: parsed.data.requestId,
    frameId: parsed.data.frameId,
    screenshotPath: parsed.data.screenshotPath,
    screenshotDataUrl: parsed.data.screenshotDataUrl,
    refreshedScreenshotDataUrl: parsed.data.refreshedScreenshotDataUrl,
    captureHash: parsed.data.captureHash,
  }
}

export function formatHostLiveParseError(error: z.ZodError): string {
  return formatIssues(error)
}