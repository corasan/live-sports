import { describe, expect, it } from 'vitest'
import type { GameEvent } from '#/domain/event'
import { applyEvent } from '#/domain/game'
import { createSimulation } from '#/sim/simulation'
import { createFeed, eventAt, ingest, lookup, type Feed } from './feed'
import { simulatedFeed } from './fixtures'
import { size } from './ring'

function gamesOf(feed: Feed) {
  return feed.gameIds.map((id) => lookup(feed.games, id))
}

function feedEvents(feed: Feed): GameEvent[] {
  return Array.from({ length: size(feed.order) }, (_, index) => eventAt(feed, index))
}

function expectInSync(feed: Feed) {
  const ids = feedEvents(feed).map((event) => event.id)
  expect(feed.events.size).toBe(size(feed.order))
  expect(new Set(ids)).toEqual(new Set(feed.events.keys()))
}

describe('ingest', () => {
  it('folds a real run into the same games as applying each event directly', () => {
    const { initial, final, events, feed } = simulatedFeed(7, 300, 20_000)
    const folded = initial.map((game) =>
      events.filter((event) => event.gameId === game.id).reduce(applyEvent, game),
    )
    expect(events.length).toBeGreaterThan(100)
    expect(gamesOf(feed)).toEqual(folded)
    expect(gamesOf(feed)).toEqual(final.games.map(({ game }) => game))
  })

  it('keeps every event while under capacity', () => {
    const { events, feed } = simulatedFeed(11, 120, 20_000)
    expectInSync(feed)
    expect(feedEvents(feed)).toEqual(events.toReversed())
  })

  it('evicts the oldest events past capacity and keeps byId and order in sync', () => {
    const { events, feed } = simulatedFeed(11, 120, 25)
    expect(events.length).toBeGreaterThan(25)
    expectInSync(feed)
    expect(feedEvents(feed)).toEqual(events.slice(-25).toReversed())
  })

  it('returns the same feed for an empty batch', () => {
    const feed = createFeed(createSimulation(3).games.map(({ game }) => game))
    expect(ingest(feed, [])).toBe(feed)
  })
})
