import { describe, expect, it } from 'vitest'
import { createRing, newest, push } from './ring'

describe('ring', () => {
  it('returns values newest-first and reports the ones it overwrote', () => {
    const first = push(createRing<string>(3), ['a', 'b'])
    const second = push(first.ring, ['c', 'd', 'e'])
    expect(first.evicted).toEqual([])
    expect(second.evicted).toEqual(['a', 'b'])
    expect(second.ring.size).toBe(3)
    expect(newest(second.ring, 10)).toEqual(['e', 'd', 'c'])
    expect(newest(second.ring, 2)).toEqual(['e', 'd'])
  })

  it('evicts values written earlier in the same batch when the batch exceeds capacity', () => {
    const { ring, evicted } = push(createRing<number>(2), [1, 2, 3, 4, 5])
    expect(evicted).toEqual([1, 2, 3])
    expect(newest(ring, 2)).toEqual([5, 4])
  })

  it('leaves the previous ring untouched', () => {
    const before = push(createRing<number>(2), [1, 2]).ring
    push(before, [3])
    expect(newest(before, 2)).toEqual([2, 1])
  })
})
