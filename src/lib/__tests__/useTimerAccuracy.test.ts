import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTimer } from '../useTimer'

// Background tabs throttle setInterval (to ~1/s, or ~1/min with intensive
// throttling). These tests move the clock without firing the skipped ticks.
function jumpClock(ms: number) {
  vi.setSystemTime(Date.now() + ms)
}

describe('useTimer accuracy when ticks are throttled', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-12T09:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('measures elapsed time from the clock, not from the number of ticks', () => {
    const { result } = renderHook(() => useTimer())
    act(() => result.current.start())

    act(() => {
      jumpClock(60_000)
      vi.advanceTimersByTime(100)
    })

    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(60_000)
    expect(result.current.elapsedMs).toBeLessThan(61_000)
  })

  it('completes a countdown on the first tick after its end time', () => {
    const onComplete = vi.fn()
    const { result } = renderHook(() => useTimer({ durationMs: 25 * 60_000, onComplete }))
    act(() => result.current.start())

    act(() => {
      jumpClock(26 * 60_000)
      vi.advanceTimersByTime(100)
    })

    expect(result.current.state).toBe('done')
    expect(result.current.elapsedMs).toBe(25 * 60_000)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('catches up as soon as the tab becomes visible again', () => {
    const { result } = renderHook(() => useTimer())
    act(() => result.current.start())

    act(() => {
      jumpClock(30_000)
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(30_000)
  })

  it('does not count time spent paused', () => {
    const { result } = renderHook(() => useTimer())
    act(() => result.current.start())
    act(() => {
      jumpClock(10_000)
      vi.advanceTimersByTime(100)
    })
    act(() => result.current.pause())

    act(() => jumpClock(60_000))
    act(() => result.current.resume())
    act(() => {
      jumpClock(5_000)
      vi.advanceTimersByTime(100)
    })

    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(15_000)
    expect(result.current.elapsedMs).toBeLessThan(16_000)
  })
})
