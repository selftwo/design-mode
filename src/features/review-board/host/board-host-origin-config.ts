export function readAllowedBoardHostOrigins(
  location: Pick<Location, 'origin' | 'search'>,
): readonly string[] {
  const origins = new Set([location.origin])
  const parameters = new URLSearchParams(location.search)

  for (const value of parameters.getAll('hostOrigin')) {
    try {
      const url = new URL(value)
      if (url.protocol === 'http:' || url.protocol === 'https:') origins.add(url.origin)
    } catch {
      continue
    }
  }

  return [...origins]
}
