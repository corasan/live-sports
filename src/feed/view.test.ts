import { describe, expect, it } from 'vitest'
import type { GameEvent } from '#/domain/event'
import type { Game } from '#/domain/game'
import { createFeed, ingest, type Feed } from './feed'
import { feedEvents, gamesOf, simulate, simulatedFeed } from './fixtures'
import { size } from './ring'
import {
  DEFAULT_QUERY,
  parseFeedQuery,
  selectFeedRows,
  selectVisibleGames,
  type FeedQuery,
  type FeedRow,
} from './view'

const { feed } = simulatedFeed(7, 120, 20_000)

const STATUS_ORDER = { live: 0, scheduled: 1, final: 2 }

function margin(game: Game): number {
  return Math.abs(game.score.home - game.score.away)
}

function query(overrides: Partial<FeedQuery>): FeedQuery {
  return { ...DEFAULT_QUERY, ...overrides }
}

function eventsOf(rows: readonly FeedRow[]): GameEvent[] {
  return rows.flatMap((row) => (row.kind === 'event' ? [row.event] : []))
}

function sections(rows: readonly FeedRow[]): { label: string; events: GameEvent[] }[] {
  const result: { label: string; events: GameEvent[] }[] = []
  for (const row of rows) {
    if (row.kind === 'group') result.push({ label: row.label, events: [] })
    else result[result.length - 1].events.push(row.event)
  }
  return result
}

describe('selectVisibleGames', () => {
  it('keeps only games in the chosen league, in schedule order', () => {
    const games = selectVisibleGames(feed, query({ league: 'NHL' }))
    expect(games.length).toBeGreaterThan(0)
    expect(games).toEqual(gamesOf(feed).filter((game) => game.league === 'NHL'))
  })

  it('matches team names case-insensitively, ignoring surrounding whitespace', () => {
    const name = gamesOf(feed)[0].home.name
    const needle = name.slice(1, 5).toLowerCase()
    const games = selectVisibleGames(feed, query({ q: `  ${needle.toUpperCase()} ` }))
    expect(games).toContain(gamesOf(feed)[0])
    expect(games).toEqual(
      gamesOf(feed).filter((game) =>
        `${game.home.name}|${game.away.name}`.toLowerCase().includes(needle),
      ),
    )
  })

  it('sorts closest games by margin, then live before scheduled before final', () => {
    const games = selectVisibleGames(feed, query({ sort: 'closest' }))
    expect(new Set(games)).toEqual(new Set(gamesOf(feed)))
    expect(new Set(games.map(margin)).size).toBeGreaterThan(1)
    const position = new Map(feed.gameIds.map((id, index) => [id, index]))
    for (const [a, b] of games.slice(1).map((game, index) => [games[index], game] as const)) {
      const order = [
        margin(a) - margin(b),
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
        (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0),
      ]
      expect(order.find((difference) => difference !== 0)).toBeLessThan(0)
    }
  })
})

describe('selectFeedRows', () => {
  it('lists every event at or above the minimum severity, newest first, without headers', () => {
    const rows = selectFeedRows(feed, query({ severity: 'notable' }))
    const expected = feedEvents(feed).filter((event) => event.severity !== 'info')
    expect(expected.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.kind === 'event')).toBe(true)
    expect(eventsOf(rows)).toEqual(expected)
  })

  it('heads each game section, orders sections by newest event, and keeps events newest-first', () => {
    const age = new Map(feedEvents(feed).map((event, index) => [event.id, index]))
    const rows = selectFeedRows(feed, query({ group: 'game' }))
    expect(rows[0].kind).toBe('group')
    const groups = sections(rows)
    expect(groups.length).toBeGreaterThan(1)
    for (const group of groups) {
      const game = feed.games.get(group.events[0].gameId)
      expect(group.label).toBe(`${game?.away.name} @ ${game?.home.name}`)
      expect(new Set(group.events.map((event) => event.gameId)).size).toBe(1)
    }
    const ages = groups.map((group) => group.events.map((event) => age.get(event.id) ?? -1))
    for (const within of ages) expect(within).toEqual(within.toSorted((a, b) => a - b))
    const heads = ages.map((within) => within[0])
    expect(heads).toEqual(heads.toSorted((a, b) => a - b))
    expect(ages.flat().toSorted((a, b) => a - b)).toEqual(
      Array.from({ length: size(feed.order) }, (_, i) => i),
    )
  })
})

describe('memoization', () => {
  const { initial, batches } = simulate(7, 120)
  const latest = batches.findLastIndex((batch) => batch.length > 0)
  const before = batches.slice(0, latest).reduce(ingest, createFeed(initial))
  const after = ingest(before, batches[latest])

  it.each([
    ['selectVisibleGames', (target: Feed, q: FeedQuery) => selectVisibleGames(target, q)],
    ['selectFeedRows', (target: Feed, q: FeedQuery) => selectFeedRows(target, q)],
  ])('%s returns the cached result until the feed or a query field changes', (_, select) => {
    const base = query({ league: 'NBA' })
    const first = select(before, base)
    expect(select(before, { ...base })).toBe(first)
    const ingested = select(after, base)
    expect(ingested).not.toBe(first)
    expect(select(after, query({ league: 'NHL' }))).not.toBe(ingested)
  })
})

describe('parseFeedQuery', () => {
  it('keeps valid fields and falls back per field for the rest', () => {
    expect(
      parseFeedQuery({ league: 'NFL', severity: 'loud', q: 'hawks', sort: 'closest' }),
    ).toEqual({ league: 'NFL', severity: 'info', q: 'hawks', sort: 'closest', group: 'none' })
  })
})
