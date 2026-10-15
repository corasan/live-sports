import { describe, expect, it } from 'vitest'
import type { Connection } from './feed'
import { feedStatus, formatAge, RECOVERED_FOR_MS, STALE_AFTER_MS } from './freshness'

describe('formatAge', () => {
  it('floors to seconds under a minute and to minutes from a minute up', () => {
    expect(formatAge(59_999)).toBe('59s ago')
    expect(formatAge(60_000)).toBe('1m ago')
  })
})

describe('feedStatus', () => {
  const recovered: Connection = {
    kind: 'recovered',
    at: 10_000,
    recovery: { kind: 'gap', missed: 42 },
  }

  it('reports reconnecting over staleness while the connection is down', () => {
    const status = feedStatus(
      { syncedAt: 0, connection: { kind: 'reconnecting', since: 1000 } },
      60_000,
      false,
    )
    expect(status).toEqual({ kind: 'reconnecting', lostMs: 59_000 })
  })

  it('reports the recovery for a window after reconnecting, then falls back to freshness', () => {
    const feed = { syncedAt: 10_000, connection: recovered }
    expect(feedStatus(feed, 10_000 + RECOVERED_FOR_MS, false)).toEqual({
      kind: 'recovered',
      recovery: { kind: 'gap', missed: 42 },
    })
    expect(feedStatus(feed, 10_000 + RECOVERED_FOR_MS + 1, false)).toEqual({
      kind: 'stale',
      ageMs: RECOVERED_FOR_MS + 1,
      paused: false,
    })
    expect(feedStatus({ syncedAt: 14_000, connection: recovered }, 15_001, false)).toBeNull()
  })

  it('reports stale only once the last sync is older than the threshold', () => {
    const live: Connection = { kind: 'live' }
    expect(feedStatus({ syncedAt: 0, connection: live }, STALE_AFTER_MS, true)).toBeNull()
    expect(feedStatus({ syncedAt: 0, connection: live }, STALE_AFTER_MS + 1, true)).toEqual({
      kind: 'stale',
      ageMs: STALE_AFTER_MS + 1,
      paused: true,
    })
    expect(feedStatus({ syncedAt: null, connection: live }, 60_000, false)).toBeNull()
  })
})
