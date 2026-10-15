import { describe, expect, it } from 'vitest'
import { applyEvent } from '#/domain/game'
import { ingest, type Feed } from './feed'
import { feedEvents, gamesOf, simulatedFeed } from './fixtures'
import { size } from './ring'

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

  it('treats an empty batch as a heartbeat that only advances syncedAt', () => {
    const { feed } = simulatedFeed(3, 60, 20_000)
    const synced = ingest(feed, [], 61_000)
    expect(synced.syncedAt).toBe(61_000)
    expect(synced.games).toBe(feed.games)
    expect(synced.gameIds).toBe(feed.gameIds)
    expect(synced.events).toBe(feed.events)
    expect(synced.order).toBe(feed.order)
  })
})
