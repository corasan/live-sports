import { describe, expect, it } from 'vitest'
import type { GameEvent } from '#/domain/event'
import { applyEvent } from '#/domain/game'
import { createFeed, ingest, receive, type Feed, type FeedMessage } from './feed'
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

function eventMessages(batches: readonly (readonly GameEvent[])[]): FeedMessage[] {
  return batches.map((events) => ({ kind: 'events', events }))
}

describe('receive', () => {
  const SEED = 7
  const TICKS = 300
  const { initial, final, batches } = simulate(SEED, TICKS)
  const dropFrom = batches.findIndex((batch) =>
    batch.some((event) => event.kind === 'game_scheduled'),
  )
  const dropTo = dropFrom + 5
  const before = ingestTicks(createFeed(initial), batches.slice(0, dropFrom))
  const slate = simulate(SEED, dropTo).final.games.map(({ game }) => game)
  const missed = batches.slice(dropFrom, dropTo).flat().length

  function resynced(feed: Feed, since: number, now: number): Feed {
    return receive(
      feed,
      [
        { kind: 'disconnected', since },
        { kind: 'resynced', games: slate, since, missed },
      ],
      now,
    )
  }

  it('marks the feed reconnecting without advancing syncedAt', () => {
    const lost = receive(before, [{ kind: 'disconnected', since: 99_000 }], 100_000)
    expect(lost.connection).toEqual({ kind: 'reconnecting', since: 99_000 })
    expect(lost.syncedAt).toBe(before.syncedAt)
    expect(lost.order).toBe(before.order)
  })

  it('replays a caught-up backlog in order and reports how many events it recovered', () => {
    const backlog = batches.slice(dropFrom, dropTo).flat()
    const recovered = receive(
      before,
      [
        { kind: 'disconnected', since: 1 },
        { kind: 'caught-up', events: backlog },
      ],
      2,
    )
    expect(recovered).toEqual({
      ...ingestTicks(before, batches.slice(dropFrom, dropTo)),
      syncedAt: 2,
      connection: { kind: 'recovered', at: 2, recovery: { kind: 'caught-up', events: missed } },
    })
  })

  it('cannot ingest past a dropped game_scheduled without a resync', () => {
    expect(() => ingestTicks(before, batches.slice(dropTo))).toThrow(/missing/)
  })

  it('resyncs from a snapshot so later events for a newly scheduled game apply cleanly', () => {
    const synced = resynced(before, 50_000, 60_000)
    expect(synced.connection).toEqual({
      kind: 'recovered',
      at: 60_000,
      recovery: { kind: 'gap', missed },
    })
    expect(synced.gaps).toEqual([{ at: before.order.written, from: 50_000, to: 60_000, missed }])
    expect(gamesOf(synced)).toEqual(slate)
    const caughtUp = receive(synced, eventMessages(batches.slice(dropTo)), 70_000)
    expect(gamesOf(caughtUp)).toEqual(final.games.map(({ game }) => game))
    expect(new Set(caughtUp.games.keys())).toEqual(
      new Set([...caughtUp.gameIds, ...caughtUp.eventCounts.keys()]),
    )
  })

  it('merges back-to-back gaps at the same ring position into one marker', () => {
    const twice = resynced(resynced(before, 50_000, 60_000), 61_000, 70_000)
    expect(twice.gaps).toEqual([
      { at: before.order.written, from: 50_000, to: 70_000, missed: missed * 2 },
    ])
  })

  it('prunes a gap once every event before it has left the ring', () => {
    const small = ingestTicks(createFeed(initial, 25), batches.slice(0, dropFrom))
    const synced = resynced(small, 50_000, 60_000)
    const later = batches.slice(dropTo)
    let feed = synced
    let tick = 0
    while (feed.order.written < synced.order.written + 25) {
      feed = receive(feed, eventMessages([later[tick]]), 70_000)
      tick++
    }
    expect(feed.gaps).toEqual([])
    const kept = receive(synced, eventMessages([later[0]]), 70_000)
    expect(kept.gaps).toBe(synced.gaps)
  })
})
