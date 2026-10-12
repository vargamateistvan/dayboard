import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, listPresets, loadPreset, renamePreset, savePreset } from '../settings'

describe('preset names that match built-in object keys', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty'])('saves and loads a preset named %s', (name) => {
    savePreset(name, DEFAULT_SETTINGS)

    expect(listPresets().map((preset) => preset.name)).toEqual([name])
    expect(loadPreset(name)?.name).toBe(name)
  })

  it('returns null for a missing preset named like a built-in', () => {
    expect(loadPreset('toString')).toBeNull()
  })

  it('renames a preset to a built-in key name', () => {
    savePreset('Work', DEFAULT_SETTINGS)
    expect(() => renamePreset('Work', 'constructor')).not.toThrow()
    expect(listPresets().map((preset) => preset.name)).toEqual(['constructor'])
  })

  it('does not pollute Object.prototype', () => {
    savePreset('__proto__', { ...DEFAULT_SETTINGS, theme: 'ocean' })
    listPresets()
    expect(({} as Record<string, unknown>).settings).toBeUndefined()
  })
})
