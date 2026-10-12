// Guarded localStorage access. Reads never throw (blocked storage, corrupt JSON);
// failed writes (quota, blocked storage) return false and fire STORAGE_ERROR_EVENT
// so the UI can tell the user their change was not saved.

export const STORAGE_ERROR_EVENT = 'dayboard:storage-error'

export interface StorageErrorDetail {
  key: string
  error: unknown
}

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    window.dispatchEvent(
      new CustomEvent<StorageErrorDetail>(STORAGE_ERROR_EVENT, { detail: { key, error } }),
    )
    return false
  }
}

export function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Nothing useful to do when storage is unavailable.
  }
}

export function readJson<T>(key: string, normalize: (value: unknown) => T | null, fallback: T): T {
  const raw = readStorage(key)
  if (raw === null) return fallback

  try {
    return normalize(JSON.parse(raw)) ?? fallback
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): boolean {
  return writeStorage(key, JSON.stringify(value))
}
