import type { GameEvent } from '#/domain/event'
import { createSimulation, step, type SimState } from './simulation'

export type Pump = {
  readonly sim: SimState
  readonly pending: readonly GameEvent[]
  readonly owed: number
}

export type Drained = { readonly pump: Pump; readonly events: readonly GameEvent[] }

export function createPump(seed: number): Pump {
  return { sim: createSimulation(seed), pending: [], owed: 0 }
}

export function drain(pump: Pump, rate: number, elapsedMs: number, now: number): Drained {
  const owed = pump.owed + (rate * elapsedMs) / 1000
  const due = Math.floor(owed)
  let { sim, pending } = pump
  const events: GameEvent[] = []
  while (events.length < due) {
    if (pending.length === 0) {
      const result = step(sim, now)
      sim = result.state
      pending = result.events
    }
    const taken = pending.slice(0, due - events.length)
    for (const event of taken) events.push({ ...event, ts: now })
    pending = pending.slice(taken.length)
  }
  return { pump: { sim, pending, owed: owed - due }, events }
}
