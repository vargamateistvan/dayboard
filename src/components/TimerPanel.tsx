import { useState } from 'react'
import { useTimer } from '../lib/useTimer'
import { useSettings } from '../lib/useSettings'
import styles from './TimerPanel.module.css'

type Mode = 'stopwatch' | 'countdown' | 'pomodoro'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function formatMs(ms: number, showTenths = false): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const tenths = Math.floor((ms % 1000) / 100)
  const base = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
  return showTenths ? `${base}.${tenths}` : base
}

// ---------- Stopwatch ----------
function Stopwatch() {
  const { elapsedMs, state, start, pause, resume, reset } = useTimer()
  return (
    <div className={styles.timerBody}>
      <div className={styles.display}>{formatMs(elapsedMs, true)}</div>
      <div className={styles.controls}>
        {state === 'idle' && (
          <button className={styles.btnPrimary} onClick={start}>Start</button>
        )}
        {state === 'running' && (
          <button className={styles.btnSecondary} onClick={pause}>Pause</button>
        )}
        {state === 'paused' && (
          <>
            <button className={styles.btnPrimary} onClick={resume}>Resume</button>
            <button className={styles.btnGhost} onClick={reset}>Reset</button>
          </>
        )}
        {state === 'running' && (
          <button className={styles.btnGhost} onClick={reset}>Reset</button>
        )}
      </div>
    </div>
  )
}

// ---------- Countdown ----------
function Countdown() {
  const [inputMin, setInputMin] = useState(5)
  const [done, setDone] = useState(false)
  const durationMs = inputMin * 60_000
  const { elapsedMs, state, start, pause, resume, reset } = useTimer({
    durationMs,
    onComplete: () => setDone(true),
  })
  const remaining = Math.max(0, durationMs - elapsedMs)

  const handleReset = () => {
    reset()
    setDone(false)
  }

  return (
    <div className={styles.timerBody}>
      {state === 'idle' && (
        <div className={styles.inputRow}>
          <label className={styles.inputLabel}>Minutes</label>
          <input
            className={styles.numberInput}
            type="number"
            min={1}
            max={180}
            value={inputMin}
            onChange={(e) => setInputMin(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </div>
      )}
      <div className={[styles.display, done ? styles.done : ''].join(' ')}>
        {done ? '⏰ Done!' : formatMs(remaining)}
      </div>
      <div className={styles.controls}>
        {state === 'idle' && (
          <button className={styles.btnPrimary} onClick={start}>Start</button>
        )}
        {state === 'running' && (
          <button className={styles.btnSecondary} onClick={pause}>Pause</button>
        )}
        {(state === 'paused' || state === 'done') && (
          <button className={styles.btnPrimary} onClick={resume} disabled={state === 'done'}>
            Resume
          </button>
        )}
        {state !== 'idle' && (
          <button className={styles.btnGhost} onClick={handleReset}>Reset</button>
        )}
      </div>
    </div>
  )
}

// ---------- Pomodoro ----------
type PomodoroPhase = 'work' | 'break'

function Pomodoro() {
  const { settings } = useSettings()
  const [phase, setPhase] = useState<PomodoroPhase>('work')
  const [sessions, setSessions] = useState(0)
  const [waitingNext, setWaitingNext] = useState(false)

  const workMs = settings.pomodoroWorkMinutes * 60_000
  const breakMs = settings.pomodoroBreakMinutes * 60_000
  const durationMs = phase === 'work' ? workMs : breakMs

  const handleComplete = () => setWaitingNext(true)

  const { elapsedMs, state, start, pause, resume, reset } = useTimer({ durationMs, onComplete: handleComplete })
  const remaining = Math.max(0, durationMs - elapsedMs)

  const startNext = () => {
    if (phase === 'work') setSessions((s) => s + 1)
    setPhase((p) => (p === 'work' ? 'break' : 'work'))
    setWaitingNext(false)
    reset()
  }

  const handleReset = () => {
    reset()
    setWaitingNext(false)
    setPhase('work')
    setSessions(0)
  }

  return (
    <div className={styles.timerBody}>
      <div className={styles.phaseBadge} data-phase={phase}>
        {phase === 'work' ? '🎯 Work' : '☕ Break'}
      </div>
      <div className={styles.display}>{formatMs(remaining)}</div>
      {sessions > 0 && (
        <div className={styles.sessions}>Sessions completed: {sessions}</div>
      )}
      <div className={styles.controls}>
        {state === 'idle' && !waitingNext && (
          <button className={styles.btnPrimary} onClick={start}>Start</button>
        )}
        {state === 'running' && (
          <button className={styles.btnSecondary} onClick={pause}>Pause</button>
        )}
        {state === 'paused' && (
          <button className={styles.btnPrimary} onClick={resume}>Resume</button>
        )}
        {waitingNext && (
          <button className={styles.btnPrimary} onClick={startNext}>
            Start {phase === 'work' ? 'Break' : 'Work'}
          </button>
        )}
        {state !== 'idle' && (
          <button className={styles.btnGhost} onClick={handleReset}>Reset</button>
        )}
      </div>
    </div>
  )
}

// ---------- TimerPanel ----------
const TABS: { id: Mode; label: string }[] = [
  { id: 'stopwatch', label: '⏱ Stopwatch' },
  { id: 'countdown', label: '⏳ Countdown' },
  { id: 'pomodoro', label: '🍅 Pomodoro' },
]

export function TimerPanel() {
  const [mode, setMode] = useState<Mode>('stopwatch')

  return (
    <div className={styles.panel}>
      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={mode === t.id}
            className={[styles.tab, mode === t.id ? styles.activeTab : ''].join(' ')}
            onClick={() => setMode(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={styles.content}>
        {mode === 'stopwatch' && <Stopwatch />}
        {mode === 'countdown' && <Countdown />}
        {mode === 'pomodoro' && <Pomodoro />}
      </div>
    </div>
  )
}
