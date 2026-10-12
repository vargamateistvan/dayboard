import { StrictMode } from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { NotesWidget } from '../NotesWidget'

const KEY = 'dayboard_notes'

const savedNotes = [
  { id: '1', text: 'Buy milk', color: 'yellow', createdAt: 1 },
  { id: '2', text: 'Call Sam', color: 'blue', createdAt: 2 },
]

describe('NotesWidget', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('keeps saved notes when mounted under StrictMode', () => {
    localStorage.setItem(KEY, JSON.stringify(savedNotes))

    render(
      <StrictMode>
        <NotesWidget />
      </StrictMode>,
    )

    expect(screen.getByDisplayValue('Buy milk')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Call Sam')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(KEY) ?? '[]')).toHaveLength(2)
  })

  it('does not overwrite unreadable saved notes on mount', () => {
    localStorage.setItem(KEY, '{not json')
    render(<NotesWidget />)
    expect(localStorage.getItem(KEY)).toBe('{not json')
  })

  it('renders when the stored value is not a list', () => {
    localStorage.setItem(KEY, '{"text":"oops"}')
    expect(() => render(<NotesWidget />)).not.toThrow()
  })

  it('repairs malformed notes instead of crashing', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([{ id: '1', color: 'purple' }, null, { id: '2', text: 'Valid', color: 'pink', createdAt: 5 }]),
    )

    render(<NotesWidget />)

    expect(screen.getByDisplayValue('Valid')).toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
  })

  it('shows notes saved in another tab', () => {
    render(<NotesWidget />)

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: JSON.stringify(savedNotes) }))
    })

    expect(screen.getByDisplayValue('Buy milk')).toBeInTheDocument()
  })
})
