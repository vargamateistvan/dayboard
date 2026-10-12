// Geometry of the lit part of the moon for a phase in [0, 1):
// 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter.

export interface MoonShape {
  /** Share of the disc that is lit, 0 to 1. */
  litFraction: number
  /** Northern-hemisphere view: waxing moons are lit on the right. */
  litSide: 'right' | 'left'
  /** Horizontal radius of the terminator ellipse relative to the disc. */
  terminatorScale: number
  gibbous: boolean
}

export function describeMoonShape(phase: number): MoonShape {
  const p = ((phase % 1) + 1) % 1
  const angle = 2 * Math.PI * p
  const litFraction = (1 - Math.cos(angle)) / 2
  return {
    litFraction,
    litSide: p < 0.5 ? 'right' : 'left',
    terminatorScale: Math.abs(Math.cos(angle)),
    gibbous: litFraction > 0.5,
  }
}

/**
 * SVG path of the lit area in a box of size 2r: a half disc on the lit side,
 * closed by half of the terminator ellipse. The ellipse bulges toward the lit
 * side for a crescent and toward the dark side for a gibbous moon.
 */
export function moonLitPath(phase: number, r: number): string {
  const { litSide, terminatorScale, gibbous } = describeMoonShape(phase)
  const rx = (r * terminatorScale).toFixed(3)
  const top = `${r} 0`
  const bottom = `${r} ${2 * r}`
  // SVG sweep flag 1 = clockwise on screen.
  const outerSweep = litSide === 'right' ? 1 : 0
  const bulgesRight = litSide === 'right' ? !gibbous : gibbous
  const innerSweep = bulgesRight ? 0 : 1
  return `M ${top} A ${r} ${r} 0 0 ${outerSweep} ${bottom} A ${rx} ${r} 0 0 ${innerSweep} ${top} Z`
}
