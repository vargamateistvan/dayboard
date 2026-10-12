import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_CUSTOM_COLORS, DEFAULT_SETTINGS, loadSettings } from '../settings'

function loadStored(value: Record<string, unknown>) {
  localStorage.setItem('dayboard:settings', JSON.stringify(value))
  return loadSettings()
}

describe('stored settings validation', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('falls back for an unknown theme or color scheme', () => {
    const settings = loadStored({ theme: 'foo', colorScheme: 'neon' })
    expect(settings.theme).toBe(DEFAULT_SETTINGS.theme)
    expect(settings.colorScheme).toBe(DEFAULT_SETTINGS.colorScheme)
  })

  it('keeps valid theme and color scheme values', () => {
    const settings = loadStored({ theme: 'ocean', colorScheme: 'dark' })
    expect(settings.theme).toBe('ocean')
    expect(settings.colorScheme).toBe('dark')
  })

  it('rejects custom colors that could load remote resources', () => {
    const settings = loadStored({
      customColors: {
        primary: 'red; background: url(https://evil.example/track.png)',
        primaryHover: '#123456',
        background: 'url(https://evil.example/track.png)',
        fontColor: 'image-set("https://evil.example/x.png" 1x)',
        secondaryFontColor: '#999',
      },
    })

    expect(settings.customColors?.primary).toBe(DEFAULT_CUSTOM_COLORS.primary)
    expect(settings.customColors?.primaryHover).toBe('#123456')
    expect(settings.customColors?.background).toBe(DEFAULT_CUSTOM_COLORS.background)
    expect(settings.customColors?.fontColor).toBe(DEFAULT_CUSTOM_COLORS.fontColor)
  })

  it('keeps colors and gradients the settings UI produces', () => {
    const gradient = 'linear-gradient(135deg, #0f172a, #1e3a8a)'
    const settings = loadStored({
      customColors: { ...DEFAULT_CUSTOM_COLORS, primary: '#ff0000', background: gradient },
    })

    expect(settings.customColors?.primary).toBe('#ff0000')
    expect(settings.customColors?.background).toBe(gradient)
  })
})
