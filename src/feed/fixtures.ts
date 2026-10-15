import type { GameEvent } from '#/domain/event'
import { createSimulation, step } from '#/sim/simulation'
import { createFeed, eventAt, ingest, lookup, type Feed } from './feed'
import { size } from './ring'

const TICK_MS = 1000

export function simulate(seed: number, ticks: number) {
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

export function simulatedFeed(seed: number, ticks: number, capacity: number) {
  const { initial, final, batches } = simulate(seed, ticks)
  const feed = batches.reduce(ingest, createFeed(initial, capacity))
  return { initial, final, events: batches.flat(), feed }
}

export function gamesOf(feed: Feed) {
  return feed.gameIds.map((id) => lookup(feed.games, id))
}

export function feedEvents(feed: Feed): GameEvent[] {
  return Array.from({ length: size(feed.order) }, (_, age) => eventAt(feed, age))
}
