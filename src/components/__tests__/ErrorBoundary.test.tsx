import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary, WidgetErrorBoundary } from '../ErrorBoundary'
import { StorageErrorNotice } from '../StorageErrorNotice'
import { writeStorage } from '../../lib/storage'

let shouldThrow = true

function Flaky() {
  if (shouldThrow) throw new Error('boom')
  return <span>widget ok</span>
}

describe('WidgetErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true
    // React logs caught render errors; keep test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('contains a crashing widget and leaves its siblings rendered', () => {
    render(
      <>
        <WidgetErrorBoundary label="Weather">
          <Flaky />
        </WidgetErrorBoundary>
        <span>sibling ok</span>
      </>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Weather')
    expect(screen.getByText('sibling ok')).toBeInTheDocument()
  })

  it('re-mounts the widget when Reload widget is clicked', () => {
    render(
      <WidgetErrorBoundary label="Weather">
        <Flaky />
      </WidgetErrorBoundary>,
    )

    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: /reload weather/i }))

    expect(screen.getByText('widget ok')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows a recovery screen instead of a blank page', () => {
    shouldThrow = true
    render(
      <AppErrorBoundary>
        <Flaky />
      </AppErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i)
    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument()
  })
})

describe('StorageErrorNotice', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('appears when a storage write fails and can be dismissed', () => {
    render(<StorageErrorNotice />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    act(() => {
      writeStorage('k', 'v')
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/couldn.t save/i)

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
