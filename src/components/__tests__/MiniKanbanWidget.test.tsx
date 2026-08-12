import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MiniKanbanWidget } from '../MiniKanbanWidget'

const STORAGE_KEY = 'dayboard_kanban_cards'

describe('MiniKanbanWidget', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('adds a card to a chosen column and moves it across the board', () => {
    render(<MiniKanbanWidget />)

    fireEvent.change(screen.getByPlaceholderText('Add a card...'), {
      target: { value: 'Plan release' },
    })
    expect(screen.getByRole('button', { name: 'Card column' })).toHaveAttribute(
      'title',
      'Choose the column for new cards. You can drag cards between columns after adding them.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Card column' }))
    fireEvent.click(screen.getByRole('button', { name: 'Doing' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add kanban card' }))

    expect(screen.getByRole('heading', { name: 'Doing' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move "Plan release" right' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Move "Plan release" right' }))

    expect(screen.getByRole('button', { name: 'Move "Plan release" left' })).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"column":"done"')
  })

  it('supports drag and drop between columns', () => {
    render(<MiniKanbanWidget />)

    fireEvent.change(screen.getByPlaceholderText('Add a card...'), {
      target: { value: 'Drag me' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add kanban card' }))

    const handle = screen.getByRole('button', { name: 'Drag "Drag me"' })
    const doneColumn = screen.getByLabelText('Done column')
    const dataTransfer = {
      data: {} as Record<string, string>,
      effectAllowed: '',
      setData(type: string, value: string) {
        this.data[type] = value
      },
      getData(type: string) {
        return this.data[type] ?? ''
      },
    }

    fireEvent.dragStart(handle, { dataTransfer })
    fireEvent.drop(doneColumn, { dataTransfer })
    fireEvent.dragEnd(handle)

    expect(screen.getByRole('button', { name: 'Move "Drag me" left' })).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"column":"done"')
  })

  it('allows editing and deleting cards', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: '1',
          title: 'Draft scope',
          column: 'todo',
          createdAt: 1,
          updatedAt: 1,
        },
      ]),
    )

    render(<MiniKanbanWidget />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit "Draft scope"' }))
    const input = screen.getByRole('textbox', { name: 'Edit "Draft scope"' })
    fireEvent.change(input, { target: { value: 'Draft roadmap' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByRole('button', { name: 'Edit "Draft roadmap"' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete "Draft roadmap"' }))
    expect(screen.queryByText('Draft roadmap')).not.toBeInTheDocument()
  })
})
