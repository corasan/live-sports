import type { GameEvent } from '#/domain/event'
import { createSimulation, step } from '#/sim/simulation'
import { createFeed, ingest } from './feed'

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
  return { initial, final, batches, events: batches.flat(), feed }
}
