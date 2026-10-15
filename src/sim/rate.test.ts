import { describe, expect, it } from 'vitest'
import { DEFAULT_RATE, positionOf, RATE_MAX, RATE_MIN, rateAt } from './rate'

const POSITIONS = Array.from({ length: 21 }, (_, i) => i / 20)

describe('log rate mapping', () => {
  it('spans the rate bounds at the slider ends', () => {
    expect(rateAt(0)).toBeCloseTo(RATE_MIN)
    expect(rateAt(1)).toBeCloseTo(RATE_MAX)
    expect(positionOf(RATE_MIN)).toBeCloseTo(0)
    expect(positionOf(RATE_MAX)).toBeCloseTo(1)
  })

  it('round-trips positions through rates', () => {
    for (const position of POSITIONS) expect(positionOf(rateAt(position))).toBeCloseTo(position)
  })

  it('gives equal slider distance to equal rate ratios', () => {
    expect(positionOf(20) - positionOf(10)).toBeCloseTo(positionOf(1000) - positionOf(500))
  })

  it('clamps out-of-range input to the bounds', () => {
    expect(rateAt(-1)).toBeCloseTo(RATE_MIN)
    expect(rateAt(2)).toBeCloseTo(RATE_MAX)
    expect(positionOf(0)).toBe(0)
    expect(positionOf(1e6)).toBeCloseTo(1)
  })

  it('places the default rate inside the bounds', () => {
    expect(positionOf(DEFAULT_RATE)).toBeGreaterThan(0)
    expect(positionOf(DEFAULT_RATE)).toBeLessThan(1)
  })
})
