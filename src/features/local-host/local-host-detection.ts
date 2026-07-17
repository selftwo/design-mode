declare global {
  interface Window {
    // Injected by the design-mode host into the HTML it serves. Its presence
    // switches the canvas from the window message host to the HTTP host.
    __designModeHost?: { version: number }
  }
}

export function isServedByLocalHost(targetWindow: Window = window): boolean {
  return targetWindow.__designModeHost?.version === 1
}

export function activeProjectIdFromLocation(location: Location = window.location): string | null {
  return new URLSearchParams(location.search).get('project')
}
