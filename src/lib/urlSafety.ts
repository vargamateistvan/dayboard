// User-supplied URLs (settings, imported presets, saved links) end up in
// href and iframe src attributes. Only plain web URLs are allowed there, so a
// shared preset cannot smuggle in a `javascript:` or `data:` URL.
export function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false

  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function safeHttpUrlOr(value: unknown, fallback: string): string {
  return isSafeHttpUrl(value) ? value.trim() : fallback
}
