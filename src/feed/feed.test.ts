import { describe, expect, it } from 'vitest'
import { applyEvent } from '#/domain/game'
import { createFeed, ingest, type Feed } from './feed'
import { feedEvents, gamesOf, ingestTicks, simulate, simulatedFeed, TICK_MS } from './fixtures'
import { size } from './ring'

function expectInSync(feed: Feed) {
  const ids = feedEvents(feed).map((event) => event.id)
  expect(feed.events.size).toBe(size(feed.order))
  expect(new Set(ids)).toEqual(new Set(feed.events.keys()))
}

describe('ingest', () => {
  it('folds a real run into the same games as applying each event directly', () => {
    const { initial, final, events, feed } = simulatedFeed(7, 300, 20_000)
    const starts = new Map(initial.map((game) => [game.id, game]))
    for (const event of events)
      if (event.kind === 'game_scheduled') starts.set(event.gameId, event.game)
    const folded = [...starts].map(([id, start]) =>
      events.filter((event) => event.gameId === id).reduce(applyEvent, start),
    )
    expect(events.some((event) => event.kind === 'game_scheduled')).toBe(true)
    expect([...feed.games.values()]).toEqual(folded)
    expect(gamesOf(feed)).toEqual(final.games.map(({ game }) => game))
  })

  it('swaps a scheduled game into the slot of the game it replaces', () => {
    const { batches } = simulate(7, 300)
    const at = batches.findIndex((batch) => batch.some((event) => event.kind === 'game_scheduled'))
    const before = ingestTicks(createFeed(simulate(7, 0).initial), batches.slice(0, at))
    const after = ingest(before, batches[at], at * TICK_MS)
    const scheduled = batches[at].flatMap((event) =>
      event.kind === 'game_scheduled' ? [event] : [],
    )
    expect(after.gameIds).toEqual(
      before.gameIds.map((id) => scheduled.find((event) => event.replaces === id)?.gameId ?? id),
    )
    for (const event of scheduled) {
      expect(after.games.get(event.gameId)).toEqual(event.game)
      expect(after.games.get(event.replaces)?.status).toBe('final')
    }
  })

  it.each([25, 400, 20_000])(
    'keeps exactly the slate and the games with events in the ring at capacity %i',
    (capacity) => {
      const { feed } = simulatedFeed(13, 600, capacity)
      const counts = new Map<string, number>()
      for (const event of feedEvents(feed))
        counts.set(event.gameId, (counts.get(event.gameId) ?? 0) + 1)
      expect(new Map(feed.eventCounts)).toEqual(counts)
      expect(new Set(feed.games.keys())).toEqual(new Set([...feed.gameIds, ...counts.keys()]))
    },
  )

  it('drops retired games once their events leave a small ring', () => {
    const { events, feed } = simulatedFeed(13, 600, 25)
    const retired = events.flatMap((event) =>
      event.kind === 'game_scheduled' ? [event.replaces] : [],
    )
    expect(retired.length).toBeGreaterThan(20)
    expect(feed.games.size).toBeLessThanOrEqual(feed.gameIds.length + 25)
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
