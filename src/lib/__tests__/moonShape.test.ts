import { describe, expect, it } from 'vitest'
import { describeMoonShape, moonLitPath } from '../moonShape'

describe('describeMoonShape', () => {
  it.each([
    [0, 0],
    [0.25, 0.5],
    [0.5, 1],
    [0.75, 0.5],
    [1, 0],
  ])('phase %f is %f lit', (phase, fraction) => {
    expect(describeMoonShape(phase).litFraction).toBeCloseTo(fraction, 5)
  })

  it('lights the right side while waxing and the left while waning', () => {
    expect(describeMoonShape(0.1).litSide).toBe('right')
    expect(describeMoonShape(0.4).litSide).toBe('right')
    expect(describeMoonShape(0.6).litSide).toBe('left')
    expect(describeMoonShape(0.9).litSide).toBe('left')
  })

  it('is a crescent before first quarter and gibbous after', () => {
    expect(describeMoonShape(0.1).litFraction).toBeLessThan(0.5)
    expect(describeMoonShape(0.4).litFraction).toBeGreaterThan(0.5)
  })
})

describe('moonLitPath', () => {
  it('draws a closed path for every phase', () => {
    for (const phase of [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9]) {
      expect(moonLitPath(phase, 10)).toMatch(/^M .* Z$/)
    }
  })
})
