import { describe, expect, it } from 'vitest'
import { memoizeLast } from './memo'

function counted() {
  let calls = 0
  const memo = memoizeLast((items: readonly number[], label: string) => {
    calls++
    return { items, label }
  })
  return { memo, calls: () => calls }
}

describe('memoizeLast', () => {
  it('reuses the result for a new array with the same elements', () => {
    const { memo, calls } = counted()
    const first = memo([1, 2], 'a')
    expect(memo([1, 2], 'a')).toBe(first)
    expect(calls()).toBe(1)
  })

  it('recomputes when an array element, its length, or a scalar arg changes', () => {
    const { memo, calls } = counted()
    memo([1, 2], 'a')
    memo([1, 3], 'a')
    memo([1, 3, 4], 'a')
    memo([1, 3, 4], 'b')
    expect(calls()).toBe(4)
  })

  it('compares array elements by identity, not deep equality', () => {
    let calls = 0
    const memo = memoizeLast((items: readonly { readonly n: number }[]) => {
      calls++
      return items
    })
    memo([{ n: 1 }])
    memo([{ n: 1 }])
    expect(calls).toBe(2)
  })

  it('treats an array and a non-array as different', () => {
    let calls = 0
    const memo = memoizeLast((value: readonly number[] | number) => {
      calls++
      return value
    })
    memo([])
    memo(0)
    expect(calls).toBe(2)
  })
})
