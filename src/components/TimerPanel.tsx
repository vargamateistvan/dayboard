import { useState, useEffect, useRef } from 'react'
import { useTimer } from '../lib/useTimer'
import { useSettings } from '../lib/useSettings'
import { usePomodoroStats } from '../lib/usePomodoroStats'
import { requestNotificationPermission, showPomodoroNotification } from '../lib/notifications'
import {
  Play, Pause, RotateCcw, Timer, AlarmClock, Coffee,
  Target, Hourglass, StopCircle, ChevronRight, BarChart3,
} from 'lucide-react'
import { beep } from '../lib/beep'
import { PomodoroStats } from './PomodoroStats'
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
          <button className={styles.btnPrimary} onClick={start}><Play size={14} />Start</button>
        )}
        {state === 'running' && (
          <button className={styles.btnSecondary} onClick={pause}><Pause size={14} />Pause</button>
        )}
        {state === 'paused' && (
          <>
            <button className={styles.btnPrimary} onClick={resume}><Play size={14} />Resume</button>
            <button className={styles.btnGhost} onClick={reset}><RotateCcw size={14} />Reset</button>
          </>
        )}
        {state === 'running' && (
          <button className={styles.btnGhost} onClick={reset}><RotateCcw size={14} />Reset</button>
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
    onComplete: () => { setDone(true); beep('done') },
  })
  const remaining = Math.max(0, durationMs - elapsedMs)

  // Tick beep for last 3 seconds
  const lastTickRef = useRef(-1)
  useEffect(() => {
    if (state !== 'running') return
    const sec = Math.ceil(remaining / 1000)
    if (sec <= 3 && sec > 0 && sec !== lastTickRef.current) {
      lastTickRef.current = sec
      beep('tick')
    }
  }, [remaining, state])

  const handleReset = () => {
    reset()
    setDone(false)
    lastTickRef.current = -1
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
        {done ? 'Done!' : formatMs(remaining)}
      </div>
      <div className={styles.controls}>
        {state === 'idle' && (
          <button className={styles.btnPrimary} onClick={start}><Play size={14} />Start</button>
        )}
        {state === 'running' && (
          <button className={styles.btnSecondary} onClick={pause}><Pause size={14} />Pause</button>
        )}
        {(state === 'paused' || state === 'done') && (
          <button className={styles.btnPrimary} onClick={resume} disabled={state === 'done'}>
            <Play size={14} />Resume
          </button>
        )}
        {state !== 'idle' && (
          <button className={styles.btnGhost} onClick={handleReset}><RotateCcw size={14} />Reset</button>
        )}
      </div>
    </div>
  )
}

// ---------- Pomodoro ----------
type PomodoroPhase = 'work' | 'break'

function Pomodoro() {
  const { settings } = useSettings()
  const { recordSession } = usePomodoroStats()
  const [phase, setPhase] = useState<PomodoroPhase>('work')
  const [sessions, setSessions] = useState(0)
  const [waitingNext, setWaitingNext] = useState(false)
  const [autoCycle, setAutoCycle] = useState(true)
  const [showStats, setShowStats] = useState(false)

  const workMs = settings.pomodoroWorkMinutes * 60_000
  const breakMs = settings.pomodoroBreakMinutes * 60_000
  const durationMs = phase === 'work' ? workMs : breakMs

  const handleComplete = () => {
    beep('done')
    showPomodoroNotification(phase, autoCycle)
    recordSession(phase === 'work' ? settings.pomodoroWorkMinutes : 0)
    
    if (autoCycle) {
      // Auto-start next phase after 1 second
      setTimeout(() => {
        startNext()
      }, 1000)
    } else {
      setWaitingNext(true)
    }
  }

  const { elapsedMs, state, start, pause, resume, reset } = useTimer({ durationMs, onComplete: handleComplete })
  const remaining = Math.max(0, durationMs - elapsedMs)

  // Tick beep for last 3 seconds
  const lastTickRef = useRef(-1)
  useEffect(() => {
    if (state !== 'running') return
    const sec = Math.ceil(remaining / 1000)
    if (sec <= 3 && sec > 0 && sec !== lastTickRef.current) {
      lastTickRef.current = sec
      beep('tick')
    }
  }, [remaining, state])

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission()
  }, [])

  const startNext = () => {
    if (phase === 'work') setSessions((s) => s + 1)
    setPhase((p) => (p === 'work' ? 'break' : 'work'))
    setWaitingNext(false)
    lastTickRef.current = -1
    reset()
    start()
  }

  const handleReset = () => {
    reset()
    setWaitingNext(false)
    setPhase('work')
    setSessions(0)
    lastTickRef.current = -1
  }

  return (
    <div className={styles.timerBody}>
      <div className={styles.phaseBadge} data-phase={phase}>
        {phase === 'work'
          ? <><Target size={12} />Work</>
          : <><Coffee size={12} />Break</>}
      </div>
      <div className={styles.display}>{formatMs(remaining)}</div>
      {sessions > 0 && (
        <div className={styles.sessions}>
          <StopCircle size={11} />
          {sessions} session{sessions !== 1 ? 's' : ''} completed
        </div>
      )}
      <div className={styles.controls}>
        {state === 'idle' && !waitingNext && (
          <button className={styles.btnPrimary} onClick={start}><Play size={14} />Start</button>
        )}
        {state === 'running' && (
          <button className={styles.btnSecondary} onClick={pause}><Pause size={14} />Pause</button>
        )}
        {state === 'paused' && (
          <button className={styles.btnPrimary} onClick={resume}><Play size={14} />Resume</button>
        )}
        {waitingNext && (
          <button className={styles.btnPrimary} onClick={startNext}>
            <ChevronRight size={14} />
            Start {phase === 'work' ? 'Break' : 'Work'}
          </button>
        )}
        {state !== 'idle' && (
          <button className={styles.btnGhost} onClick={handleReset}><RotateCcw size={14} />Reset</button>
        )}
        <button
          className={styles.btnGhost}
          onClick={() => setShowStats(!showStats)}
          title="Show/hide stats"
        >
          <BarChart3 size={14} />
        </button>
      </div>
      
      {/* Auto-cycle toggle */}
      <div className={styles.autoCycleToggle}>
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={autoCycle}
            onChange={(e) => setAutoCycle(e.target.checked)}
          />
          Auto-cycle breaks
        </label>
      </div>

      {/* Stats section */}
      {showStats && <PomodoroStats />}
    </div>
  )
}

// ---------- TimerPanel ----------
const TABS: { id: Mode; label: string; icon: React.ReactNode }[] = [
  { id: 'stopwatch', label: 'Stopwatch', icon: <Timer size={14} /> },
  { id: 'countdown', label: 'Countdown', icon: <Hourglass size={14} /> },
  { id: 'pomodoro',  label: 'Pomodoro',  icon: <AlarmClock size={14} /> },
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
            {t.icon}{t.label}
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
