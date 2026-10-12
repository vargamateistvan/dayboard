import { useCallback, useEffect, useRef, useState } from 'react'
import { readJson, writeJson } from './storage'

type SetValue<T> = (next: T | ((prev: T) => T)) => void

function parseOrFallback<T>(raw: string | null, normalize: (value: unknown) => T | null, fallback: T): T {
  if (raw === null) return fallback
  try {
    return normalize(JSON.parse(raw)) ?? fallback
  } catch {
    return fallback
  }
}

/**
 * State backed by a localStorage key.
 * - Loads synchronously on the first render.
 * - Writes only when the setter is called, never on mount, so StrictMode
 *   double-mounts and unreadable stored data cannot overwrite what is saved.
 * - Follows changes made in other tabs via `storage` events.
 */
export function useSyncedStorage<T>(
  key: string,
  normalize: (value: unknown) => T | null,
  fallback: T,
): [T, SetValue<T>] {
  const [value, setValue] = useState<T>(() => readJson(key, normalize, fallback))
  const valueRef = useRef(value)
  const normalizeRef = useRef(normalize)
  const fallbackRef = useRef(fallback)
  normalizeRef.current = normalize
  fallbackRef.current = fallback

  const update = useCallback<SetValue<T>>(
    (next) => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(valueRef.current) : next
      valueRef.current = resolved
      setValue(resolved)
      writeJson(key, resolved)
    },
    [key],
  )

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== key) return
      const synced = parseOrFallback(event.newValue, normalizeRef.current, fallbackRef.current)
      valueRef.current = synced
      setValue(synced)
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [key])

  return [value, update]
}
