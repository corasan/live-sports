import { describe, expect, it } from 'vitest'
import type { GameEvent } from '#/domain/event'
import { applyEvent } from '#/domain/game'
import { createSimulation, step } from '#/sim/simulation'
import { createFeed, gamesOf, ingest, latestEvents, type Feed } from './feed'

const TICK_MS = 1000

function run(seed: number, ticks: number) {
  const initial = createSimulation(seed)
  let state = initial
  const batches: GameEvent[][] = []
  for (let i = 0; i < ticks; i++) {
    const result = step(state, i * TICK_MS)
    state = result.state
    batches.push([...result.events])
  }
  return { initial: initial.games.map(({ game }) => game), final: state, batches }
}

function feedOf(seed: number, ticks: number, capacity: number) {
  const { initial, final, batches } = run(seed, ticks)
  const feed = batches.reduce(ingest, createFeed(initial, capacity))
  return { initial, final, events: batches.flat(), feed }
}

function expectInSync(feed: Feed) {
  const ids = latestEvents(feed, feed.order.size).map((event) => event.id)
  expect(feed.events.size).toBe(feed.order.size)
  expect(new Set(ids)).toEqual(new Set(feed.events.keys()))
}

describe('ingest', () => {
  it('folds a real run into the same games as applying each event directly', () => {
    const { initial, final, events, feed } = feedOf(7, 300, 20_000)
    const folded = initial.map((game) =>
      events.filter((event) => event.gameId === game.id).reduce(applyEvent, game),
    )
    expect(events.length).toBeGreaterThan(100)
    expect(gamesOf(feed)).toEqual(folded)
    expect(gamesOf(feed)).toEqual(final.games.map(({ game }) => game))
  })

  it('keeps every event while under capacity', () => {
    const { events, feed } = feedOf(11, 120, 20_000)
    expectInSync(feed)
    expect(feed.order.size).toBe(events.length)
    expect(latestEvents(feed, events.length)).toEqual(events.toReversed())
  })

  it('evicts the oldest events past capacity and keeps byId and order in sync', () => {
    const { events, feed } = feedOf(11, 120, 25)
    expect(events.length).toBeGreaterThan(25)
    expectInSync(feed)
    expect(feed.order.size).toBe(25)
    expect(latestEvents(feed, 60)).toEqual(events.slice(-25).toReversed())
  })

  it('returns the same feed for an empty batch', () => {
    const feed = createFeed(createSimulation(3).games.map(({ game }) => game))
    expect(ingest(feed, [])).toBe(feed)
  })
})
