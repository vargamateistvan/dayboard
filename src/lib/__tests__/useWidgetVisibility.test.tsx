import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useWidgetVisibility } from '../useWidgetVisibility'

function Probe({ label }: { label: string }) {
  const { visibility, toggleWidget } = useWidgetVisibility()

  return (
    <div>
      <span>{String(visibility.weather)}</span>
      <button onClick={() => toggleWidget('weather')} aria-label={`toggle-${label}`}>
        toggle
      </button>
    </div>
  )
}

describe('useWidgetVisibility', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('shares widget visibility across consumers', () => {
    render(
      <div>
        <Probe label="left" />
        <Probe label="right" />
      </div>,
    )

    expect(screen.getAllByText('true')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'toggle-left' }))

    expect(screen.getAllByText('false')).toHaveLength(2)
    expect(JSON.parse(localStorage.getItem('dayboard_widget_visibility') ?? '{}').weather).toBe(false)
  })
})
