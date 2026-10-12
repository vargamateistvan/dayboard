import { afterEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useFocusMode } from '../useFocusMode'

function pressK(init: KeyboardEventInit = {}, target: EventTarget = window) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, ...init }))
  })
}

describe('useFocusMode shortcut', () => {
  afterEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('toggles with Cmd+K and Ctrl+K', () => {
    const { result } = renderHook(() => useFocusMode())
    pressK()
    expect(result.current.focusMode).toBe(true)
    pressK({ metaKey: false, ctrlKey: true })
    expect(result.current.focusMode).toBe(false)
  })

  it('works with Shift or Caps Lock held', () => {
    const { result } = renderHook(() => useFocusMode())
    pressK({ key: 'K' })
    expect(result.current.focusMode).toBe(true)
  })

  it('ignores key repeat while the keys are held down', () => {
    const { result } = renderHook(() => useFocusMode())
    pressK()
    pressK({ repeat: true })
    expect(result.current.focusMode).toBe(true)
  })

  it.each([
    ['input', () => document.createElement('input')],
    ['textarea', () => document.createElement('textarea')],
    [
      'contenteditable',
      () => {
        const el = document.createElement('div')
        el.setAttribute('contenteditable', 'true')
        return el
      },
    ],
  ])('does not fire while typing in a %s', (_label, create) => {
    const { result } = renderHook(() => useFocusMode())
    const field = create()
    document.body.appendChild(field)

    pressK({}, field)

    expect(result.current.focusMode).toBe(false)
  })
})
