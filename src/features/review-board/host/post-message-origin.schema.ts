import { z } from 'zod'

export function isCanonicalHttpOrigin(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    if (url.username || url.password) return false
    if (url.pathname !== '/' && url.pathname !== '') return false
    if (url.search || url.hash) return false
    return url.origin === value
  } catch {
    return false
  }
}

export const PostMessageOriginSchema = z.string().refine(isCanonicalHttpOrigin, {
  message: 'must be a canonical http(s) origin',
})