/**
 * Generates a color palette based on theme primary and secondary colors
 * Creates variations by adjusting lightness and saturation
 */

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return { h, s, l }
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0

  if (h < 1 / 6) {
    r = c
    g = x
  } else if (h < 2 / 6) {
    r = x
    g = c
  } else if (h < 3 / 6) {
    g = c
    b = x
  } else if (h < 4 / 6) {
    g = x
    b = c
  } else if (h < 5 / 6) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  const toHex = (value: number) => {
    const hex = Math.round((value + m) * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Generate a palette of colors based on a primary color
 * Creates lighter and darker variations
 */
export function generateColorPalette(primaryHex: string): string[] {
  const { h, s } = hexToHSL(primaryHex)
  const palette: string[] = []

  // Generate variations from very light to very dark
  const lightnesses = [0.95, 0.85, 0.75, 0.65, 0.55, 0.50, 0.45, 0.35, 0.25, 0.15]

  lightnesses.forEach((lightness) => {
    palette.push(hslToHex(h, s, lightness))
  })

  return palette
}

/**
 * Get current theme colors from CSS variables
 */
export function getThemeColors(): { primary: string; secondary: string } {
  const root = document.documentElement
  const computedStyle = getComputedStyle(root)

  const primary = computedStyle.getPropertyValue('--color-accent').trim() || '#4f46e5'
  const secondary = computedStyle.getPropertyValue('--color-success').trim() || '#38a169'

  return { primary, secondary }
}

/**
 * Generate combined palette from primary and secondary theme colors
 */
export function getThemePalette(): string[] {
  const { primary, secondary } = getThemeColors()

  const primaryPalette = generateColorPalette(primary)
  const secondaryPalette = generateColorPalette(secondary)

  // Combine and deduplicate
  const combined = [...primaryPalette, ...secondaryPalette]
  const unique = Array.from(new Set(combined))

  return unique.slice(0, 20)
}
