const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return 'now'
  const delta = Math.max(0, now - then)
  if (delta < MINUTE_MS) return 'now'
  const minutes = Math.floor(delta / MINUTE_MS)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(delta / HOUR_MS)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(delta / DAY_MS)
  return `${days}d`
}
