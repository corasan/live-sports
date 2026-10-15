import { describe, expect, it } from 'vitest'
import type { GameEvent } from '#/domain/event'
import { createPump, drain, type Pump } from './pump'
import { createSimulation, step } from './simulation'

const SEED = 99

const TENTHS_OF_MS = [167, 333, 81, 2500, 166, 42]

function tenths(count: number): number[] {
  return Array.from({ length: count }, (_, i) => TENTHS_OF_MS[i % TENTHS_OF_MS.length])
}

function frames(count: number): number[] {
  return tenths(count).map((t) => t / 10)
}

function pumpThrough(pump: Pump, rate: number, elapsed: readonly number[]) {
  let current = pump
  const events: GameEvent[] = []
  for (const [i, ms] of elapsed.entries()) {
    const result = drain(current, rate, ms, i)
    current = result.pump
    events.push(...result.events)
  }
  return { pump: current, events }
}

function plainStream(count: number): GameEvent[] {
  let state = createSimulation(SEED)
  const events: GameEvent[] = []
  while (events.length < count) {
    const result = step(state, 0)
    state = result.state
    events.push(...result.events)
  }
  return events.slice(0, count)
}

const withoutTs = (events: readonly GameEvent[]) => events.map((event) => ({ ...event, ts: 0 }))

describe('drain', () => {
  it.each([1, 7.5, 137, 2000])('releases floor(rate * seconds) at %d events/sec', (rate) => {
    const totalTenths = tenths(600).reduce((sum, t) => sum + t, 0)
    const { events } = pumpThrough(createPump(SEED), rate, frames(600))
    expect(events).toHaveLength(Math.floor((rate * totalTenths) / 10_000))
  })

  it('releases the same events in the same order as stepping the simulation', () => {
    const { events } = pumpThrough(createPump(SEED), 450, frames(200))
    expect(events.length).toBeGreaterThan(1000)
    expect(withoutTs(events)).toEqual(withoutTs(plainStream(events.length)))
  })

  it('stamps each released event with the drain time', () => {
    const { events } = drain(createPump(SEED), 500, 100, 1234)
    expect(events).toHaveLength(50)
    expect(events.every((event) => event.ts === 1234)).toBe(true)
  })

  it('honors a rate change mid-run, carrying the fractional remainder', () => {
    const slow = pumpThrough(
      createPump(SEED),
      3,
      Array.from({ length: 60 }, () => 16),
    )
    expect(slow.events).toHaveLength(2)
    const fast = pumpThrough(
      slow.pump,
      1500,
      Array.from({ length: 50 }, () => 10),
    )
    expect(fast.events).toHaveLength(750)
    expect(fast.pump.owed).toBeCloseTo(0.88)
  })

  it('does not advance the simulation when nothing is due', () => {
    const pump = createPump(SEED)
    const { pump: next, events } = drain(pump, 2000, 0, 0)
    expect(events).toEqual([])
    expect(next.sim).toBe(pump.sim)
  })
})
