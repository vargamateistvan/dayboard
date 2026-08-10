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
        { id: '1', text: 'Original task', completed: false, createdAt: 1, dueDate: '' },
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
        { id: '1', text: 'Original task', completed: false, createdAt: 1, dueDate: '' },
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

  it('shows unfinished tasks before completed tasks', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: '1', text: 'Completed first', completed: true, createdAt: 10, dueDate: '' },
        { id: '2', text: 'Unfinished second', completed: false, createdAt: 9, dueDate: '' },
      ]),
    )

    render(<TaskWidget />)

    const labels = screen.getAllByRole('button', { name: /Edit "/i })
      .map((button) => button.getAttribute('aria-label'))
    expect(labels[0]).toBe('Edit "Unfinished second"')
    expect(labels[1]).toBe('Edit "Completed first"')
  })

  it('adds and renders an optional task date', () => {
    render(<TaskWidget />)

    fireEvent.change(screen.getByPlaceholderText('Add a task...'), {
      target: { value: 'Task with date' },
    })
    fireEvent.change(screen.getByLabelText('Task date'), {
      target: { value: '2026-08-10' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))

    expect(document.querySelector('time[dateTime="2026-08-10"]')).not.toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"dueDate":"2026-08-10"')
  })
})
