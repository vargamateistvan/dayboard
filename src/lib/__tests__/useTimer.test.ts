import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTimer } from '../useTimer'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useTimer — stopwatch mode', () => {
  it('starts in idle state with elapsed 0', () => {
    const { result } = renderHook(() => useTimer())
    expect(result.current.state).toBe('idle')
    expect(result.current.elapsedMs).toBe(0)
  })

  it('advances elapsed when running', () => {
    const { result } = renderHook(() => useTimer())
    act(() => result.current.start())
    act(() => vi.advanceTimersByTime(300))
    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(300)
    expect(result.current.state).toBe('running')
  })

  it('pauses and stops incrementing', () => {
    const { result } = renderHook(() => useTimer())
    act(() => result.current.start())
    act(() => vi.advanceTimersByTime(200))
    act(() => result.current.pause())
    const snapMs = result.current.elapsedMs
    act(() => vi.advanceTimersByTime(500))
    expect(result.current.elapsedMs).toBe(snapMs)
    expect(result.current.state).toBe('paused')
  })

  it('resumes from where it paused', () => {
    const { result } = renderHook(() => useTimer())
    act(() => result.current.start())
    act(() => vi.advanceTimersByTime(200))
    act(() => result.current.pause())
    const snapMs = result.current.elapsedMs
    act(() => result.current.resume())
    act(() => vi.advanceTimersByTime(100))
    expect(result.current.elapsedMs).toBeGreaterThan(snapMs)
    expect(result.current.state).toBe('running')
  })

  it('reset returns elapsed to 0 and state to idle', () => {
    const { result } = renderHook(() => useTimer())
    act(() => result.current.start())
    act(() => vi.advanceTimersByTime(500))
    act(() => result.current.reset())
    expect(result.current.elapsedMs).toBe(0)
    expect(result.current.state).toBe('idle')
  })
})

describe('useTimer — countdown mode', () => {
  it('transitions to done when elapsed reaches duration', () => {
    const { result } = renderHook(() => useTimer({ durationMs: 1000 }))
    act(() => result.current.start())
    act(() => vi.advanceTimersByTime(1100))
    expect(result.current.state).toBe('done')
    expect(result.current.elapsedMs).toBe(1000)
  })

  it('fires onComplete callback when countdown finishes', () => {
    const onComplete = vi.fn()
    const { result } = renderHook(() => useTimer({ durationMs: 500, onComplete }))
    act(() => result.current.start())
    act(() => vi.advanceTimersByTime(600))
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('does not fire onComplete if reset before finishing', () => {
    const onComplete = vi.fn()
    const { result } = renderHook(() => useTimer({ durationMs: 1000, onComplete }))
    act(() => result.current.start())
    act(() => vi.advanceTimersByTime(400))
    act(() => result.current.reset())
    act(() => vi.advanceTimersByTime(2000))
    expect(onComplete).not.toHaveBeenCalled()
  })
})
