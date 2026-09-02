import { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import { isMotionEnabled, loadAnimeJs, MOTION_DURATIONS, MOTION_STAGGERS } from '../lib/anime'
import styles from './TaskWidget.module.css'

interface Task {
  id: string
  text: string
  completed: boolean
  createdAt: number
  dueDate: string
}

const STORAGE_KEY = 'dayboard_tasks'
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function formatTaskDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(year, month - 1, day))
}

function normalizeTask(raw: unknown): Task | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const maybeTask = raw as Partial<Task>
  const id = typeof maybeTask.id === 'string' ? maybeTask.id : ''
  const text = typeof maybeTask.text === 'string' ? maybeTask.text.trim() : ''

  if (!id || !text) {
    return null
  }

  const dueDate = typeof maybeTask.dueDate === 'string' && DATE_INPUT_PATTERN.test(maybeTask.dueDate)
    ? maybeTask.dueDate
    : ''

  return {
    id,
    text,
    completed: Boolean(maybeTask.completed),
    createdAt: typeof maybeTask.createdAt === 'number' ? maybeTask.createdAt : Date.now(),
    dueDate,
  }
}

interface TaskWidgetProps {
  readonly isFullscreen?: boolean
}

export function TaskWidget({ isFullscreen = false }: TaskWidgetProps) {
  // Initialize from localStorage to avoid hydration mismatch
  const [tasks, setTasks] = useState<Task[]>(() => {
    if (typeof window === 'undefined') return []
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as unknown
        if (!Array.isArray(parsed)) {
          return []
        }
        return parsed
          .map(normalizeTask)
          .filter((task): task is Task => task !== null)
      } catch {
        console.error('Failed to load tasks from localStorage')
        return []
      }
    }
    return []
  })
  const [input, setInput] = useState('')
  const [inputDate, setInputDate] = useState('')
  const [mounted, setMounted] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const widgetRootRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  // Mark component as mounted to avoid hydration issues
  useEffect(() => {
    setMounted(true)
  }, [])

  // Save tasks to localStorage whenever they change (only after mount)
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
    }
  }, [tasks, mounted])

  const addTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const newTask: Task = {
      id: Date.now().toString(),
      text: input.trim(),
      completed: false,
      createdAt: Date.now(),
      dueDate: inputDate,
    }
    setTasks([newTask, ...tasks])
    setInput('')
    setInputDate('')
  }

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => (t.id === id ? { ...t, completed: !t.completed } : t)))
  }

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id))
  }

  const startEditingTask = (task: Task) => {
    setEditingTaskId(task.id)
    setEditingText(task.text)
  }

  const cancelEditingTask = () => {
    setEditingTaskId(null)
    setEditingText('')
  }

  const saveEditingTask = (id: string) => {
    const nextText = editingText.trim()

    if (!nextText) {
      cancelEditingTask()
      return
    }

    setTasks(tasks.map(task => (task.id === id ? { ...task, text: nextText } : task)))
    setEditingTaskId(null)
    setEditingText('')
  }

  const completedCount = tasks.filter(t => t.completed).length
  const totalCount = tasks.length
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1
    }
    return b.createdAt - a.createdAt
  })
  const taskAnimationSignature = useMemo(
    () =>
      sortedTasks
        .map((task) => `${task.id}:${task.completed ? '1' : '0'}:${task.text.length}`)
        .join('|'),
    [sortedTasks],
  )

  useEffect(() => {
    if (!isMotionEnabled()) {
      return
    }

    const listNode = listRef.current
    if (!listNode) {
      return
    }

    const taskNodes = Array.from(listNode.querySelectorAll<HTMLElement>(`.${styles.taskItem}`))
    if (!taskNodes.length) {
      return
    }

    let cancelled = false
    let activeAnimations: Array<{ cancel?: () => void }> = []

    void loadAnimeJs().then((anime) => {
      if (cancelled || !anime?.animate) {
        return
      }

      if (anime.stagger) {
        activeAnimations = [
          anime.animate(taskNodes, {
            opacity: [0, 1],
            translateY: [8, 0],
            duration: MOTION_DURATIONS.medium,
            delay: anime.stagger(MOTION_STAGGERS.tight),
          }),
        ]
        return
      }

      activeAnimations = taskNodes.map((taskNode, index) =>
        anime.animate(taskNode, {
          opacity: [0, 1],
          translateY: [8, 0],
          duration: MOTION_DURATIONS.medium,
          delay: index * MOTION_STAGGERS.tight,
        }),
      )
    })

    return () => {
      cancelled = true
      activeAnimations.forEach((animation) => animation.cancel?.())
    }
  }, [taskAnimationSignature])

  useEffect(() => {
    if (!isMotionEnabled()) {
      return
    }

    const rootNode = widgetRootRef.current
    if (!rootNode) {
      return
    }

    const isInteractiveButton = (button: HTMLButtonElement) =>
      button.classList.contains(styles.addBtn) ||
      button.classList.contains(styles.checkBtn) ||
      button.classList.contains(styles.taskTextButton) ||
      button.classList.contains(styles.deleteBtn)

    const resolveButton = (target: EventTarget | null) => {
      if (!(target instanceof Element)) {
        return null
      }
      const button = target.closest('button')
      return button instanceof HTMLButtonElement ? button : null
    }

    let cancelled = false

    const animateButton = (
      button: HTMLButtonElement,
      options: { scale: number; translateY: number; duration: number },
    ) => {
      void loadAnimeJs().then((anime) => {
        if (cancelled || !anime?.animate) {
          return
        }
        anime.animate(button, options)
      })
    }

    const handlePointerEnter = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') {
        return
      }
      const button = resolveButton(event.target)
      if (!button || !isInteractiveButton(button) || button.disabled) {
        return
      }
      animateButton(button, {
        scale: 1.015,
        translateY: -1,
        duration: MOTION_DURATIONS.quick,
      })
    }

    const handlePointerLeave = (event: PointerEvent) => {
      const button = resolveButton(event.target)
      if (!button || !isInteractiveButton(button)) {
        return
      }
      animateButton(button, {
        scale: 1,
        translateY: 0,
        duration: MOTION_DURATIONS.quick,
      })
    }

    const handlePointerDown = (event: PointerEvent) => {
      const button = resolveButton(event.target)
      if (!button || !isInteractiveButton(button) || button.disabled) {
        return
      }
      animateButton(button, {
        scale: 0.98,
        translateY: 0,
        duration: Math.max(80, MOTION_DURATIONS.quick - 50),
      })
    }

    const handlePointerUp = (event: PointerEvent) => {
      const button = resolveButton(event.target)
      if (!button || !isInteractiveButton(button) || button.disabled) {
        return
      }
      animateButton(button, {
        scale: button.matches(':hover') ? 1.015 : 1,
        translateY: button.matches(':hover') ? -1 : 0,
        duration: MOTION_DURATIONS.quick,
      })
    }

    rootNode.addEventListener('pointerenter', handlePointerEnter, true)
    rootNode.addEventListener('pointerleave', handlePointerLeave, true)
    rootNode.addEventListener('pointerdown', handlePointerDown, true)
    rootNode.addEventListener('pointerup', handlePointerUp, true)
    rootNode.addEventListener('pointercancel', handlePointerUp, true)

    return () => {
      cancelled = true
      rootNode.removeEventListener('pointerenter', handlePointerEnter, true)
      rootNode.removeEventListener('pointerleave', handlePointerLeave, true)
      rootNode.removeEventListener('pointerdown', handlePointerDown, true)
      rootNode.removeEventListener('pointerup', handlePointerUp, true)
      rootNode.removeEventListener('pointercancel', handlePointerUp, true)
    }
  }, [])

  return (
    <div ref={widgetRootRef} className={[styles.widget, isFullscreen ? styles.fullscreen : ''].join(' ')}>
      <div className={styles.header}>
        <h2>Tasks</h2>
        {totalCount > 0 && (
          <span className={styles.counter}>
            {completedCount}/{totalCount}
          </span>
        )}
      </div>

      <form onSubmit={addTask} className={styles.inputForm}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add a task..."
          className={styles.input}
          maxLength={100}
        />
        <input
          type="date"
          value={inputDate}
          onChange={(e) => setInputDate(e.target.value)}
          className={styles.dateInput}
          aria-label="Task date"
        />
        <button type="submit" className={styles.addBtn} aria-label="Add task">
          <Plus size={18} />
        </button>
      </form>

      <div ref={listRef} className={styles.list}>
        {tasks.length === 0 ? (
          <p className={styles.empty}>No tasks yet</p>
        ) : (
          sortedTasks.map(task => (
            <div key={task.id} className={styles.taskItem}>
              <button
                type="button"
                className={`${styles.checkBtn} ${task.completed ? styles.checked : ''}`}
                onClick={() => toggleTask(task.id)}
                aria-label={`Mark "${task.text}" as ${task.completed ? 'incomplete' : 'complete'}`}
              >
                {task.completed && <Check size={16} />}
              </button>
              {editingTaskId === task.id ? (
                <input
                  type="text"
                  value={editingText}
                  onChange={e => setEditingText(e.target.value)}
                  onBlur={() => saveEditingTask(task.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveEditingTask(task.id)
                    } else if (e.key === 'Escape') {
                      cancelEditingTask()
                    }
                  }}
                  className={styles.taskEditInput}
                  maxLength={100}
                  autoFocus
                  aria-label={`Edit "${task.text}"`}
                />
              ) : (
                <button
                  type="button"
                  className={`${styles.taskTextButton} ${task.completed ? styles.completed : ''}`}
                  onClick={() => startEditingTask(task)}
                  aria-label={`Edit "${task.text}"`}
                >
                  <span className={styles.taskContent}>
                    <span className={styles.taskText}>{task.text}</span>
                    {task.dueDate ? (
                      <time className={styles.taskDate} dateTime={task.dueDate}>
                        {formatTaskDate(task.dueDate)}
                      </time>
                    ) : null}
                  </span>
                </button>
              )}
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => deleteTask(task.id)}
                aria-label={`Delete "${task.text}"`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
