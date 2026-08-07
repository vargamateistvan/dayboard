import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TaskWidget } from '../TaskWidget'

const STORAGE_KEY = 'dayboard_tasks'

describe('TaskWidget', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('allows editing an existing task item', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: '1', text: 'Original task', completed: false, createdAt: 1 },
      ]),
    )

    render(<TaskWidget />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit "Original task"' }))

    const input = screen.getByRole('textbox', { name: 'Edit "Original task"' })
    fireEvent.change(input, { target: { value: 'Updated task' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByText('Updated task')).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toContain('Updated task')
  })

  it('cancels editing on escape', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: '1', text: 'Original task', completed: false, createdAt: 1 },
      ]),
    )

    render(<TaskWidget />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit "Original task"' }))

    const input = screen.getByRole('textbox', { name: 'Edit "Original task"' })
    fireEvent.change(input, { target: { value: 'Updated task' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.getByText('Original task')).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('Updated task')
  })
})
