import { StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSyncedStorage } from '../useSyncedStorage'

const KEY = 'test_list'
const asStringList = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : null

function dispatchStorage(key: string, newValue: string | null) {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue }))
}

describe('useSyncedStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('loads the stored value on the first render', () => {
    localStorage.setItem(KEY, '["a","b"]')
    const { result } = renderHook(() => useSyncedStorage(KEY, asStringList, []))
    expect(result.current[0]).toEqual(['a', 'b'])
  })

  it('does not write on mount, even under StrictMode', () => {
    localStorage.setItem(KEY, '["a"]')
    const setItem = vi.spyOn(localStorage, 'setItem')

    const { result } = renderHook(() => useSyncedStorage(KEY, asStringList, []), { wrapper: StrictMode })

    expect(result.current[0]).toEqual(['a'])
    expect(setItem).not.toHaveBeenCalled()
    expect(localStorage.getItem(KEY)).toBe('["a"]')
  })

  it('leaves unreadable data in place until the user changes something', () => {
    localStorage.setItem(KEY, '{broken')
    const { result } = renderHook(() => useSyncedStorage(KEY, asStringList, []))

    expect(result.current[0]).toEqual([])
    expect(localStorage.getItem(KEY)).toBe('{broken')
  })

  it('persists updates, including functional updates in the same tick', () => {
    const { result } = renderHook(() => useSyncedStorage(KEY, asStringList, []))

    act(() => {
      result.current[1]((prev) => [...prev, 'x'])
      result.current[1]((prev) => [...prev, 'y'])
    })

    expect(result.current[0]).toEqual(['x', 'y'])
    expect(localStorage.getItem(KEY)).toBe('["x","y"]')
  })

  it('picks up changes made in another tab', () => {
    const { result } = renderHook(() => useSyncedStorage(KEY, asStringList, []))

    act(() => dispatchStorage(KEY, '["from-other-tab"]'))
    expect(result.current[0]).toEqual(['from-other-tab'])

    // A later local edit builds on the synced value instead of overwriting it.
    act(() => result.current[1]((prev) => [...prev, 'local']))
    expect(localStorage.getItem(KEY)).toBe('["from-other-tab","local"]')
  })

  it('ignores storage events for other keys and resets on removal', () => {
    localStorage.setItem(KEY, '["a"]')
    const { result } = renderHook(() => useSyncedStorage(KEY, asStringList, []))

    act(() => dispatchStorage('other', '["nope"]'))
    expect(result.current[0]).toEqual(['a'])

    act(() => dispatchStorage(KEY, null))
    expect(result.current[0]).toEqual([])
  })
})
