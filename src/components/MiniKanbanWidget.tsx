import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import styles from './MiniKanbanWidget.module.css'

type KanbanColumn = 'todo' | 'doing' | 'done'

interface KanbanCard {
  id: string
  title: string
  column: KanbanColumn
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'dayboard_kanban_cards'
const COLUMNS: Array<{ id: KanbanColumn; label: string }> = [
  { id: 'todo', label: 'To do' },
  { id: 'doing', label: 'Doing' },
  { id: 'done', label: 'Done' },
]

function normalizeCard(raw: unknown): KanbanCard | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as Partial<KanbanCard>
  const id = typeof candidate.id === 'string' ? candidate.id : ''
  const title = typeof candidate.title === 'string' ? candidate.title.trim() : ''
  const column = candidate.column === 'doing' || candidate.column === 'done' ? candidate.column : 'todo'

  if (!id || !title) {
    return null
  }

  return {
    id,
    title,
    column,
    createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now(),
    updatedAt: typeof candidate.updatedAt === 'number' ? candidate.updatedAt : Date.now(),
  }
}

function getColumnIndex(column: KanbanColumn): number {
  return COLUMNS.findIndex((entry) => entry.id === column)
}

interface MiniKanbanWidgetProps {
  readonly isFullscreen?: boolean
}

export function MiniKanbanWidget({ isFullscreen = false }: MiniKanbanWidgetProps) {
  const [cards, setCards] = useState<KanbanCard[]>(() => {
    if (typeof window === 'undefined') {
      return []
    }

    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      return []
    }

    try {
      const parsed = JSON.parse(saved) as unknown
      return Array.isArray(parsed) ? parsed.map(normalizeCard).filter((card): card is KanbanCard => card !== null) : []
    } catch {
      console.error('Failed to load kanban cards from localStorage')
      return []
    }
  })
  const [mounted, setMounted] = useState(false)
  const [title, setTitle] = useState('')
  const [column, setColumn] = useState<KanbanColumn>('todo')
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null)
  const [columnMenuOpen, setColumnMenuOpen] = useState(false)
  const columnMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
    }
  }, [cards, mounted])

  useEffect(() => {
    if (!columnMenuOpen) {
      return undefined
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (columnMenuRef.current?.contains(event.target as Node)) {
        return
      }

      setColumnMenuOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setColumnMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [columnMenuOpen])

  const addCard = (event: FormEvent) => {
    event.preventDefault()

    const nextTitle = title.trim()
    if (!nextTitle) {
      return
    }

    const now = Date.now()
    setCards((current) => [
      {
        id: now.toString(),
        title: nextTitle,
        column,
        createdAt: now,
        updatedAt: now,
      },
      ...current,
    ])
    setTitle('')
    setColumn('todo')
  }

  const updateCard = (id: string, patch: Partial<Pick<KanbanCard, 'title' | 'column'>>) => {
    setCards((current) =>
      current.map((card) =>
        card.id === id
          ? {
              ...card,
              ...patch,
              updatedAt: card.updatedAt + 1,
            }
          : card,
      ),
    )
  }

  const moveCard = (id: string, direction: 'left' | 'right') => {
    setCards((current) =>
      current.map((card) => {
        if (card.id !== id) {
          return card
        }

        const currentIndex = getColumnIndex(card.column)
        const nextIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1
        const nextColumn = COLUMNS[nextIndex]?.id
        if (!nextColumn) {
          return card
        }

        return {
          ...card,
          column: nextColumn,
          updatedAt: card.updatedAt + 1,
        }
      }),
    )
  }

  const moveCardToColumn = (id: string, nextColumn: KanbanColumn) => {
    setCards((current) =>
      current.map((card) =>
        card.id === id
          ? {
              ...card,
              column: nextColumn,
              updatedAt: card.updatedAt + 1,
            }
          : card,
      ),
    )
  }

  const deleteCard = (id: string) => {
    setCards((current) => current.filter((card) => card.id !== id))
    if (editingCardId === id) {
      setEditingCardId(null)
      setEditingTitle('')
    }
  }

  const startEditing = (card: KanbanCard) => {
    setEditingCardId(card.id)
    setEditingTitle(card.title)
  }

  const cancelEditing = () => {
    setEditingCardId(null)
    setEditingTitle('')
  }

  const saveEditing = (id: string) => {
    const nextTitle = editingTitle.trim()
    if (!nextTitle) {
      cancelEditing()
      return
    }

    updateCard(id, { title: nextTitle })
    cancelEditing()
  }

  const cardsByColumn = useMemo(
    () =>
      COLUMNS.map((entry) => ({
        ...entry,
        cards: cards
          .filter((card) => card.column === entry.id)
          .sort((left, right) => right.updatedAt - left.updatedAt),
      })),
    [cards],
  )

  const handleDragStart = (cardId: string) => (event: DragEvent<HTMLElement>) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', cardId)
    setDraggedCardId(cardId)
  }

  const handleDragEnd = () => {
    setDraggedCardId(null)
  }

  const handleDropOnColumn = (nextColumn: KanbanColumn) => (event: DragEvent<HTMLElement>) => {
    event.preventDefault()

    const cardId = event.dataTransfer.getData('text/plain') || draggedCardId
    if (!cardId) {
      return
    }

    moveCardToColumn(cardId, nextColumn)
    setDraggedCardId(null)
  }

  return (
    <div className={[styles.widget, isFullscreen ? styles.fullscreen : ''].join(' ')}>
      <div className={styles.header}>
        <h2>Mini Kanban</h2>
        <span className={styles.counter}>{cards.length} cards</span>
      </div>

      <form className={styles.inputForm} onSubmit={addCard}>
        <input
          className={styles.input}
          type="text"
          placeholder="Add a card..."
          value={title}
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
        />
        <div className={styles.columnSelectorWrap} ref={columnMenuRef}>
          <button
            type="button"
            className={styles.columnSelectorTrigger}
            aria-label="Card column"
            aria-haspopup="menu"
            aria-expanded={columnMenuOpen}
            title="Choose the column for new cards. You can drag cards between columns after adding them."
            onClick={() => setColumnMenuOpen((current) => !current)}
          >
            <span className={styles.columnSelectorLabel}>Column</span>
            <span className={styles.columnSelectorValue}>
              {COLUMNS.find((entry) => entry.id === column)?.label ?? 'To do'}
            </span>
            <ChevronDown
              size={16}
              className={[styles.columnSelectorChevron, columnMenuOpen ? styles.columnSelectorChevronOpen : ''].join(' ')}
            />
          </button>
          {columnMenuOpen ? (
            <div className={styles.columnSelectorMenu} aria-label="Card column options">
              {COLUMNS.map((entry) => {
                const isSelected = entry.id === column

                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={[styles.columnSelectorItem, isSelected ? styles.columnSelectorItemSelected : ''].join(' ')}
                    onClick={() => {
                      setColumn(entry.id)
                      setColumnMenuOpen(false)
                    }}
                  >
                    <span className={styles.columnSelectorItemCheck}>
                      {isSelected ? <Check size={14} /> : null}
                    </span>
                    <span className={styles.columnSelectorItemLabel}>{entry.label}</span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
        <button className={styles.addBtn} type="submit" aria-label="Add kanban card">
          <Plus size={18} />
        </button>
      </form>

      <div className={styles.board}>
        {cardsByColumn.map((columnEntry) => (
          <section
            key={columnEntry.id}
            className={[
              styles.column,
              draggedCardId ? styles.columnDropTarget : '',
            ].join(' ')}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDropOnColumn(columnEntry.id)}
            aria-label={`${columnEntry.label} column`}
          >
            <div className={styles.columnHeader}>
              <h3>{columnEntry.label}</h3>
              <span>{columnEntry.cards.length}</span>
            </div>

            <div className={styles.cardList}>
              {columnEntry.cards.length === 0 ? (
                <p className={styles.empty}>No cards</p>
              ) : (
                columnEntry.cards.map((card) => {
                  const currentIndex = getColumnIndex(card.column)
                  const canMoveLeft = currentIndex > 0
                  const canMoveRight = currentIndex < COLUMNS.length - 1

                  return (
                    <article
                      key={card.id}
                      className={[styles.card, draggedCardId === card.id ? styles.cardDragging : ''].join(' ')}
                    >
                      <button
                        type="button"
                        className={styles.cardDragHandle}
                        draggable
                        onDragStart={handleDragStart(card.id)}
                        onDragEnd={handleDragEnd}
                        aria-label={`Drag "${card.title}"`}
                        title="Drag card"
                      >
                        ⋮⋮
                      </button>
                      {editingCardId === card.id ? (
                        <input
                          className={styles.editInput}
                          type="text"
                          value={editingTitle}
                          maxLength={120}
                          autoFocus
                          aria-label={`Edit "${card.title}"`}
                          onChange={(event) => setEditingTitle(event.target.value)}
                          onBlur={() => saveEditing(card.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              saveEditing(card.id)
                            } else if (event.key === 'Escape') {
                              cancelEditing()
                            }
                          }}
                        />
                      ) : (
                        <button
                          className={styles.cardTitle}
                          type="button"
                          onClick={() => startEditing(card)}
                          aria-label={`Edit "${card.title}"`}
                        >
                          {card.title}
                        </button>
                      )}

                      <div className={styles.cardActions}>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => moveCard(card.id, 'left')}
                          disabled={!canMoveLeft}
                          aria-label={`Move "${card.title}" left`}
                          title="Move left"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => moveCard(card.id, 'right')}
                          disabled={!canMoveRight}
                          aria-label={`Move "${card.title}" right`}
                          title="Move right"
                        >
                          <ChevronRight size={14} />
                        </button>
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={() => deleteCard(card.id)}
                          aria-label={`Delete "${card.title}"`}
                          title="Delete card"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
