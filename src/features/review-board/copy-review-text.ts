// Embedded hosts can deny the async clipboard; the selection fallback still works there.
export async function copyReviewText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const scratch = document.createElement('textarea')
    scratch.value = text
    document.body.append(scratch)
    scratch.select()
    const copied = document.execCommand('copy')
    scratch.remove()
    return copied
  }
}
