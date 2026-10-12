import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { clampPollIntervalMs, MAX_POLL_INTERVAL_MS, usePolledResource } from '../usePolledResource'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('clampPollIntervalMs', () => {
  it('caps huge intervals below the setInterval overflow limit', () => {
    expect(clampPollIntervalMs(40_000 * 60_000)).toBe(MAX_POLL_INTERVAL_MS)
    expect(MAX_POLL_INTERVAL_MS).toBeLessThan(2 ** 31 - 1)
  })

  it('raises tiny or invalid intervals', () => {
    expect(clampPollIntervalMs(0)).toBe(1_000)
    expect(clampPollIntervalMs(Number.NaN)).toBe(1_000)
  })
})

describe('usePolledResource', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    setHidden(false)
  })

  it('loads on mount and exposes the data', async () => {
    const fetcher = vi.fn(async () => 'v1')
    const { result } = renderHook(() => usePolledResource(fetcher, { intervalMs: 60_000, key: 'a' }))

    expect(result.current.loading).toBe(true)
    await flush()

    expect(result.current.data).toBe('v1')
    expect(result.current.loading).toBe(false)
    expect(result.current.lastUpdatedAt).not.toBeNull()
  })

  it('keeps the last good data when a refresh fails', async () => {
    let call = 0
    const fetcher = vi.fn(async () => {
      call += 1
      if (call > 1) throw new Error('HTTP 503')
      return 'good'
    })
    const { result } = renderHook(() => usePolledResource(fetcher, { intervalMs: 60_000, key: 'a' }))
    await flush()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })

    expect(result.current.data).toBe('good')
    expect(result.current.error).toBe('HTTP 503')
    expect(result.current.loading).toBe(false)
  })

  it('does not blank the data while refreshing', async () => {
    const second = deferred<string>()
    const fetcher = vi.fn().mockResolvedValueOnce('first').mockReturnValueOnce(second.promise)
    const { result } = renderHook(() => usePolledResource(fetcher, { intervalMs: 60_000, key: 'a' }))
    await flush()

    act(() => result.current.refresh())

    expect(result.current.data).toBe('first')
    expect(result.current.loading).toBe(false)
    expect(result.current.refreshing).toBe(true)
  })

  it('ignores a slow response that a newer request replaced', async () => {
    const slow = deferred<string>()
    const fast = deferred<string>()
    const fetcher = vi.fn().mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise)
    const { result } = renderHook(() => usePolledResource(fetcher, { intervalMs: 60_000, key: 'a' }))

    act(() => result.current.refresh())
    await act(async () => {
      fast.resolve('new')
      await Promise.resolve()
    })
    await act(async () => {
      slow.resolve('old')
      await Promise.resolve()
    })

    expect(result.current.data).toBe('new')
  })

  it('aborts the previous request when the key changes', async () => {
    const signals: AbortSignal[] = []
    const fetcher = vi.fn((signal: AbortSignal) => {
      signals.push(signal)
      return new Promise<string>(() => {})
    })
    const { rerender } = renderHook(({ key }) => usePolledResource(fetcher, { intervalMs: 60_000, key }), {
      initialProps: { key: 'metric' },
    })

    rerender({ key: 'imperial' })

    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
  })

  it('clears data from the previous key', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('metric data').mockReturnValueOnce(new Promise(() => {}))
    const { result, rerender } = renderHook(({ key }) => usePolledResource(fetcher, { intervalMs: 60_000, key }), {
      initialProps: { key: 'metric' },
    })
    await flush()
    expect(result.current.data).toBe('metric data')

    rerender({ key: 'imperial' })

    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  it('pauses polling while the tab is hidden and catches up when visible', async () => {
    const fetcher = vi.fn(async () => 'v')
    renderHook(() => usePolledResource(fetcher, { intervalMs: 60_000, key: 'a' }))
    await flush()
    expect(fetcher).toHaveBeenCalledTimes(1)

    setHidden(true)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000)
    })
    expect(fetcher).toHaveBeenCalledTimes(1)

    act(() => setHidden(false))
    await flush()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('does not poll at all when disabled', async () => {
    const fetcher = vi.fn(async () => 'v')
    renderHook(() => usePolledResource(fetcher, { intervalMs: 60_000, key: 'a', enabled: false }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000)
    })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
