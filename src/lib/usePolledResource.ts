import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_POLL_INTERVAL_MS = 1_000
/** One day. Well below the 2^31-1 ms where setInterval overflows and fires immediately. */
export const MAX_POLL_INTERVAL_MS = 24 * 60 * 60_000

/** First retry after a failure; doubles per consecutive failure, capped at the poll interval. */
export const FAILURE_RETRY_BASE_MS = 15_000

export function clampPollIntervalMs(ms: number): number {
  if (!Number.isFinite(ms)) return MIN_POLL_INTERVAL_MS
  return Math.min(MAX_POLL_INTERVAL_MS, Math.max(MIN_POLL_INTERVAL_MS, ms))
}

export interface PolledResource<T> {
  /** Last successful result for the current key; kept when a refresh fails. */
  data: T | null
  /** Message of the last failed request, cleared by the next success. */
  error: string | null
  /** True only while loading with nothing to show yet. */
  loading: boolean
  /** True while any request is in flight. */
  refreshing: boolean
  lastUpdatedAt: number | null
  refresh: () => void
}

interface PolledResourceOptions {
  intervalMs: number
  /** Changing the key drops the current data and loads again (e.g. new units or location). */
  key: string
  enabled?: boolean
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/**
 * Loads data now and every `intervalMs`, for widgets that poll an API.
 * - A newer request aborts the older one, so responses can never arrive out of order.
 * - Refreshes keep the current data on screen; a failed refresh keeps it too.
 * - Polling pauses while the tab is hidden and catches up when it is shown.
 * - A failed request is retried sooner than the poll interval, backing off on repeated failures.
 */
export function usePolledResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  { intervalMs, key, enabled = true }: PolledResourceOptions,
): PolledResource<T> {
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null; lastUpdatedAt: number | null }>(
    () => ({ key, data: null, error: null, lastUpdatedAt: null }),
  )
  const [inFlight, setInFlight] = useState(false)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const controllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const lastAttemptAtRef = useRef(0)
  const keyRef = useRef(key)
  keyRef.current = key
  const pollMsRef = useRef(clampPollIntervalMs(intervalMs))
  pollMsRef.current = clampPollIntervalMs(intervalMs)
  const failureCountRef = useRef(0)
  const retryTimeoutRef = useRef<number | undefined>(undefined)

  const refresh = useCallback(() => {
    window.clearTimeout(retryTimeoutRef.current)
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const requestId = ++requestIdRef.current
    const requestKey = keyRef.current
    lastAttemptAtRef.current = Date.now()
    setInFlight(true)

    fetcherRef.current(controller.signal).then(
      (data) => {
        if (requestId !== requestIdRef.current) return
        failureCountRef.current = 0
        setState({ key: requestKey, data, error: null, lastUpdatedAt: Date.now() })
        setInFlight(false)
      },
      (error: unknown) => {
        if (requestId !== requestIdRef.current || isAbortError(error)) return
        const message = error instanceof Error ? error.message : 'Request failed.'
        setState((previous) => ({ ...previous, key: requestKey, error: message }))
        setInFlight(false)

        const retryMs = Math.min(pollMsRef.current, FAILURE_RETRY_BASE_MS * 2 ** failureCountRef.current)
        failureCountRef.current += 1
        // Retrying at the poll interval adds nothing; the interval covers it.
        if (retryMs < pollMsRef.current) {
          retryTimeoutRef.current = window.setTimeout(() => {
            if (!document.hidden) refreshRef.current()
          }, retryMs)
        }
      },
    )
  }, [])
  const refreshRef = useRef(refresh)

  useEffect(() => {
    if (!enabled) return undefined

    failureCountRef.current = 0
    setState({ key, data: null, error: null, lastUpdatedAt: null })
    refresh()

    const pollMs = clampPollIntervalMs(intervalMs)
    const intervalId = window.setInterval(() => {
      if (!document.hidden) refresh()
    }, pollMs)
    const handleVisibility = () => {
      if (!document.hidden && Date.now() - lastAttemptAtRef.current >= pollMs) refresh()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.clearTimeout(retryTimeoutRef.current)
      controllerRef.current?.abort()
      requestIdRef.current += 1
      setInFlight(false)
    }
  }, [enabled, intervalMs, key, refresh])

  // Data for an older key (e.g. other units) is never shown.
  const current = state.key === key ? state : { data: null, error: null, lastUpdatedAt: null }

  return {
    data: current.data,
    error: current.error,
    loading: enabled && current.data === null && current.error === null,
    refreshing: inFlight,
    lastUpdatedAt: current.lastUpdatedAt,
    refresh,
  }
}
