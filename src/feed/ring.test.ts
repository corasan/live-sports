import { describe, expect, it } from 'vitest'
import { at, createRing, push, size, type Ring } from './ring'

function contents<T>(ring: Ring<T>): T[] {
  return Array.from({ length: size(ring) }, (_, age) => at(ring, age))
}

describe('ring', () => {
  it('returns values newest-first and reports the ones it overwrote', () => {
    const first = push(createRing<string>(3), ['a', 'b'])
    const second = push(first.ring, ['c', 'd', 'e'])
    expect(first.evicted).toEqual([])
    expect(contents(first.ring)).toEqual(['b', 'a'])
    expect(second.evicted).toEqual(['a', 'b'])
    expect(contents(second.ring)).toEqual(['e', 'd', 'c'])
  })

  it('evicts values written earlier in the same batch when the batch exceeds capacity', () => {
    const { ring, evicted } = push(createRing<number>(2), [1, 2, 3, 4, 5])
    expect(evicted).toEqual([1, 2, 3])
    expect(contents(ring)).toEqual([5, 4])
  })

  it('leaves the previous ring untouched', () => {
    const before = push(createRing<number>(2), [1, 2]).ring
    push(before, [3])
    expect(contents(before)).toEqual([2, 1])
  })

  it.each([-1, 2, 0.5])('throws for age %s outside the stored values', (age) => {
    const { ring } = push(createRing<number>(3), [1, 2])
    expect(() => at(ring, age)).toThrow(`Ring has no value at age ${age}`)
  })
})
