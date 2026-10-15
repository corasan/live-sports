import { describe, expect, it } from 'vitest'
import type { GameEvent } from '#/domain/event'
import { applyEvent, leaderOf, type Game } from '#/domain/game'
import type { GameId, TeamId } from '#/domain/ids'
import { createSimulation, step, type SimState } from './simulation'

const TICK_MS = 1000
const TICKS = 600
const SLATE_SIZE = 8
const WARMUP_TICKS = 40
const MAX_QUIET_TICKS = 5

function run(seed: number, ticks: number) {
  const initial = createSimulation(seed)
  let state = initial
  const states: SimState[] = [initial]
  const batches: (readonly GameEvent[])[] = []
  for (let i = 0; i < ticks; i++) {
    const result = step(state, i * TICK_MS)
    state = result.state
    states.push(state)
    batches.push(result.events)
  }
  return { initial, final: state, states, batches, events: batches.flat() }
}

function slateIds(state: SimState): GameId[] {
  return state.games.map(({ game }) => game.id)
}

const SEEDS = Array.from({ length: 25 }, (_, i) => i * 7919 + 1)

describe('determinism', () => {
  it('replays the same event stream for the same seed', () => {
    expect(run(42, 200).events).toEqual(run(42, 200).events)
  })

  it('diverges for different seeds', () => {
    expect(run(42, 200).events).not.toEqual(run(43, 200).events)
  })
})

describe.each(SEEDS)('a rolling slate with seed %i', (seed) => {
  const { initial, final, states, batches, events } = run(seed, TICKS)

  const streams = new Map<GameId, { start: Game; events: GameEvent[] }>(
    initial.games.map(({ game }) => [game.id, { start: game, events: [] }]),
  )
  for (const event of events) {
    if (event.kind === 'game_scheduled')
      streams.set(event.gameId, { start: event.game, events: [] })
    streams.get(event.gameId)?.events.push(event)
  }
  const folded = new Map(
    [...streams].map(([id, { start, events: stream }]) => [id, stream.reduce(applyEvent, start)]),
  )

  it('emits every event for a game it has introduced', () => {
    expect(events.every((event) => streams.has(event.gameId))).toBe(true)
  })

  it('rebuilds every slate game by folding its events through applyEvent', () => {
    expect(final.games.map(({ game }) => folded.get(game.id))).toEqual(
      final.games.map(({ game }) => game),
    )
  })

  it('finishes and replaces games along the way', () => {
    const replaced = [...folded.values()].filter((game) => game.status === 'final')
    expect(replaced.length).toBeGreaterThan(SLATE_SIZE)
    expect(replaced.length).toBe(streams.size - SLATE_SIZE)
  })

  it('ends each game with a score equal to the sum of its score events per team', () => {
    for (const [id, game] of folded) {
      const stream = streams.get(id)?.events ?? []
      const pointsFor = (team: TeamId) =>
        stream.reduce(
          (sum, event) =>
            event.kind === 'score' && event.teamId === team ? sum + event.points : sum,
          0,
        )
      expect(game.score).toEqual({ home: pointsFor(game.home.id), away: pointsFor(game.away.id) })
    }
  })

  it('emits lead_change exactly when the leader flips', () => {
    for (const { start, events: stream } of streams.values()) {
      let lastLeader: TeamId | null = null
      const expected: TeamId[] = []
      for (const event of stream) {
        if (event.kind !== 'score') continue
        const leader = leaderOf(start, event.score)
        if (leader !== null && lastLeader !== null && leader !== lastLeader) expected.push(leader)
        lastLeader = leader ?? lastLeader
      }
      const emitted = stream.flatMap((event) =>
        event.kind === 'lead_change' ? [event.leader] : [],
      )
      expect(emitted).toEqual(expected)
    }
  })

  it('advances the drive exactly after each score and period_ended', () => {
    for (const { events: stream } of streams.values()) {
      if (stream.length === 0) continue
      expect(stream[0].drive).toBe(0)
      for (const [previous, next] of stream.slice(1).map((event, i) => [stream[i], event])) {
        const closed = previous.kind === 'score' || previous.kind === 'period_ended'
        expect(next.drive - previous.drive).toBe(closed ? 1 : 0)
      }
    }
    expect(events.some((event) => event.drive > 0)).toBe(true)
  })

  it('emits nothing for a game after its game_ended', () => {
    for (const { events: stream } of streams.values()) {
      const kinds = stream.map((event) => event.kind)
      const ended = kinds.indexOf('game_ended')
      expect(ended === -1 ? [] : kinds.slice(ended + 1)).toEqual([])
    }
  })

  it('refills each finished slot in the same tick with a rematch', () => {
    for (const [tick, batch] of batches.entries()) {
      const before = slateIds(states[tick])
      const ended = batch.filter((event) => event.kind === 'game_ended').map((e) => e.gameId)
      const scheduled = batch.flatMap((event) => (event.kind === 'game_scheduled' ? [event] : []))
      expect(scheduled.map((event) => event.replaces)).toEqual(ended)
      for (const event of scheduled) {
        const finished = folded.get(event.replaces)
        expect(event.game.status).toBe('scheduled')
        expect(event.game.home).toEqual(finished?.away)
        expect(event.game.away).toEqual(finished?.home)
      }
      const replacements = new Map(scheduled.map((event) => [event.replaces, event.gameId]))
      expect(slateIds(states[tick + 1])).toEqual(before.map((id) => replacements.get(id) ?? id))
      expect(states[tick + 1].games).toHaveLength(SLATE_SIZE)
    }
  })

  it('never reuses a game id', () => {
    const ids = [
      ...slateIds(initial),
      ...events.flatMap((event) => (event.kind === 'game_scheduled' ? [event.gameId] : [])),
    ]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it(`never goes more than ${MAX_QUIET_TICKS} ticks without an event after warmup`, () => {
    let quiet = 0
    for (const batch of batches.slice(WARMUP_TICKS)) {
      quiet = batch.length === 0 ? quiet + 1 : 0
      expect(quiet).toBeLessThanOrEqual(MAX_QUIET_TICKS)
    }
  })
})
