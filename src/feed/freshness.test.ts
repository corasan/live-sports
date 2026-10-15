import { describe, expect, it } from 'vitest'
import { formatAge } from './freshness'

describe('formatAge', () => {
  it('floors to seconds under a minute and to minutes from a minute up', () => {
    expect(formatAge(59_999)).toBe('59s ago')
    expect(formatAge(60_000)).toBe('1m ago')
  })
})
