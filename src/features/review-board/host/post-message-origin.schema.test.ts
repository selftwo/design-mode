import { describe, expect, it } from 'vitest'
import { isCanonicalHttpOrigin, PostMessageOriginSchema } from './post-message-origin.schema'

describe('PostMessageOriginSchema', () => {
  it('accepts canonical http(s) origins', () => {
    expect(PostMessageOriginSchema.safeParse('http://127.0.0.1:5199').success).toBe(true)
    expect(PostMessageOriginSchema.safeParse('https://host.example').success).toBe(true)
  })

  it('rejects origins with paths, queries, hashes, or opaque values', () => {
    expect(PostMessageOriginSchema.safeParse('http://127.0.0.1:5199/live-review.html').success).toBe(false)
    expect(PostMessageOriginSchema.safeParse('http://127.0.0.1:5199?x=1').success).toBe(false)
    expect(PostMessageOriginSchema.safeParse('blob:http://127.0.0.1:5199/uuid').success).toBe(false)
    expect(PostMessageOriginSchema.safeParse('not-a-url').success).toBe(false)
    expect(isCanonicalHttpOrigin('http://127.0.0.1:5199/path')).toBe(false)
  })
})