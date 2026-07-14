export interface WindowBoardHostBinding {
  allowedLoadOrigins: readonly string[]
  requestBoardOrigins: readonly string[]
}

export function resolveWindowBoardHostBinding(
  hostWindow: Window,
  allowedLoadOrigins?: readonly string[],
): WindowBoardHostBinding {
  const loadOrigins = allowedLoadOrigins?.length
    ? [...allowedLoadOrigins]
    : [hostWindow.location.origin]
  return { allowedLoadOrigins: loadOrigins, requestBoardOrigins: loadOrigins }
}

export function isTrustedHostBoardLoadMessage(
  event: Pick<MessageEvent, 'source' | 'origin'>,
  hostWindow: Window,
  allowedLoadOrigins: readonly string[],
): boolean {
  if (event.source === null) return false
  const trustedSource =
    event.source === hostWindow
    || (hostWindow.parent !== hostWindow && event.source === hostWindow.parent)
    || (hostWindow.opener !== null && event.source === hostWindow.opener)
  if (!trustedSource) return false
  return allowedLoadOrigins.includes(event.origin)
}