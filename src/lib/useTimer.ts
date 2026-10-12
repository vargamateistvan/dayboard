import { useCallback, useEffect, useRef, useState } from 'react'

export type TimerState = 'idle' | 'running' | 'paused' | 'done'

interface UseTimerOptions {
  /** Duration in ms for countdown mode. If undefined, runs as stopwatch. */
  durationMs?: number
  onComplete?: () => void
}

interface UseTimerResult {
  elapsedMs: number
  state: TimerState
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
}

const TICK_MS = 100

export function useTimer({ durationMs, onComplete }: UseTimerOptions = {}): UseTimerResult {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [state, setState] = useState<TimerState>('idle')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Elapsed time is measured from the clock, not by counting ticks: background
  // tabs throttle setInterval, so counted ticks would run slow.
  const runStartedAtRef = useRef(0)
  const accumulatedMsRef = useRef(0)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const clear = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const measure = useCallback(() => {
    const next = accumulatedMsRef.current + (Date.now() - runStartedAtRef.current)
    return durationMs !== undefined ? Math.min(next, durationMs) : next
  }, [durationMs])

  const tick = useCallback(() => {
    setElapsedMs(measure())
  }, [measure])

  // When elapsed reaches duration, mark done
  useEffect(() => {
    if (durationMs !== undefined && elapsedMs >= durationMs && state === 'running') {
      clear()
      setState('done')
      onCompleteRef.current?.()
    }
  }, [elapsedMs, durationMs, state, clear])

  const start = useCallback(() => {
    accumulatedMsRef.current = 0
    runStartedAtRef.current = Date.now()
    setElapsedMs(0)
    setState('running')
  }, [])

  const pause = useCallback(() => {
    if (state !== 'running') return
    clear()
    const elapsed = measure()
    accumulatedMsRef.current = elapsed
    setElapsedMs(elapsed)
    setState('paused')
  }, [state, clear, measure])

  const resume = useCallback(() => {
    if (state !== 'paused') return
    runStartedAtRef.current = Date.now()
    setState('running')
  }, [state])

  const reset = useCallback(() => {
    clear()
    accumulatedMsRef.current = 0
    setElapsedMs(0)
    setState('idle')
  }, [clear])

  // Start/stop interval based on state
  useEffect(() => {
    if (state !== 'running') {
      clear()
      return clear
    }

    intervalRef.current = setInterval(tick, TICK_MS)
    // Catch up immediately when a throttled background tab becomes visible.
    document.addEventListener('visibilitychange', tick)
    return () => {
      clear()
      document.removeEventListener('visibilitychange', tick)
    }
  }, [state, tick, clear])

  return { elapsedMs, state, start, pause, resume, reset }
}
