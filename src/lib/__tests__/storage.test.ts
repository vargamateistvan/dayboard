import { afterEach, describe, expect, it, vi } from 'vitest'
import { readJson, readStorage, removeStorage, STORAGE_ERROR_EVENT, writeJson, writeStorage } from '../storage'

describe('storage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('reads and writes raw values', () => {
    expect(writeStorage('k', 'v')).toBe(true)
    expect(readStorage('k')).toBe('v')
    removeStorage('k')
    expect(readStorage('k')).toBeNull()
  })

  it('returns null when reading throws', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    expect(readStorage('k')).toBeNull()
  })

  it('returns false and dispatches an error event when writing throws', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const listener = vi.fn()
    window.addEventListener(STORAGE_ERROR_EVENT, listener)

    expect(writeStorage('k', 'v')).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toMatchObject({ key: 'k' })

    window.removeEventListener(STORAGE_ERROR_EVENT, listener)
  })

  it('readJson returns the fallback for missing, corrupt or rejected values', () => {
    const asNumber = (value: unknown) => (typeof value === 'number' ? value : null)

    expect(readJson('n', asNumber, 7)).toBe(7)

    localStorage.setItem('n', '{')
    expect(readJson('n', asNumber, 7)).toBe(7)

    localStorage.setItem('n', '"text"')
    expect(readJson('n', asNumber, 7)).toBe(7)

    localStorage.setItem('n', '42')
    expect(readJson('n', asNumber, 7)).toBe(42)
  })

  it('writeJson serializes the value', () => {
    expect(writeJson('obj', { a: 1 })).toBe(true)
    expect(localStorage.getItem('obj')).toBe('{"a":1}')
  })
})
