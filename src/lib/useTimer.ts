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
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const clear = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const tick = useCallback(() => {
    setElapsedMs((prev) => {
      const next = prev + TICK_MS
      if (durationMs !== undefined && next >= durationMs) {
        return durationMs
      }
      return next
    })
  }, [durationMs])

  // When elapsed reaches duration, mark done
  useEffect(() => {
    if (durationMs !== undefined && elapsedMs >= durationMs && state === 'running') {
      clear()
      setState('done')
      onCompleteRef.current?.()
    }
  }, [elapsedMs, durationMs, state, clear])

  const start = useCallback(() => {
    setElapsedMs(0)
    setState('running')
  }, [])

  const pause = useCallback(() => {
    if (state !== 'running') return
    clear()
    setState('paused')
  }, [state, clear])

  const resume = useCallback(() => {
    if (state !== 'paused') return
    setState('running')
  }, [state])

  const reset = useCallback(() => {
    clear()
    setElapsedMs(0)
    setState('idle')
  }, [clear])

  // Start/stop interval based on state
  useEffect(() => {
    if (state === 'running') {
      intervalRef.current = setInterval(tick, TICK_MS)
    } else {
      clear()
    }
    return clear
  }, [state, tick, clear])

  return { elapsedMs, state, start, pause, resume, reset }
}
