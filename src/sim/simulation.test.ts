import { describe, expect, it } from 'vitest'
import type { GameEvent } from '#/domain/event'
import { applyEvent, leaderOf, type Game } from '#/domain/game'
import type { TeamId } from '#/domain/ids'
import { createSimulation, step } from './simulation'

const TICK_MS = 1000
const MAX_TICKS = 500

function run(seed: number, ticks: number) {
  let state = createSimulation(seed)
  const events: GameEvent[] = []
  for (let i = 0; i < ticks; i++) {
    const result = step(state, i * TICK_MS)
    state = result.state
    events.push(...result.events)
  }
  return { final: state, events }
}

function runToCompletion(seed: number) {
  const initial = createSimulation(seed)
  let state = initial
  const events: GameEvent[] = []
  while (state.games.some(({ game }) => game.status !== 'final')) {
    if (state.tick >= MAX_TICKS)
      throw new Error(`seed ${seed} did not finish in ${MAX_TICKS} ticks`)
    const result = step(state, state.tick * TICK_MS)
    state = result.state
    events.push(...result.events)
  }
  return { initial, final: state, events }
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

describe.each(SEEDS)('a full simulation with seed %i', (seed) => {
  const { initial, final, events } = runToCompletion(seed)
  const byGame = (game: Game) => events.filter((event) => event.gameId === game.id)

  it('rebuilds every final game by folding its events through applyEvent', () => {
    const replayed = initial.games.map(({ game }) => byGame(game).reduce(applyEvent, game))
    expect(replayed).toEqual(final.games.map(({ game }) => game))
  })

  it('ends each game with a score equal to the sum of its score events per team', () => {
    for (const { game } of final.games) {
      const pointsFor = (team: TeamId) =>
        byGame(game).reduce(
          (sum, event) =>
            event.kind === 'score' && event.teamId === team ? sum + event.points : sum,
          0,
        )
      expect(game.score).toEqual({ home: pointsFor(game.home.id), away: pointsFor(game.away.id) })
    }
  })

  it('emits lead_change exactly when the leader flips', () => {
    for (const { game } of initial.games) {
      let lastLeader: TeamId | null = null
      const expected: TeamId[] = []
      for (const event of byGame(game)) {
        if (event.kind !== 'score') continue
        const leader = leaderOf(game, event.score)
        if (leader !== null && lastLeader !== null && leader !== lastLeader) expected.push(leader)
        lastLeader = leader ?? lastLeader
      }
      const emitted = byGame(game).flatMap((event) =>
        event.kind === 'lead_change' ? [event.leader] : [],
      )
      expect(emitted).toEqual(expected)
    }
  })

  it('advances the drive exactly after each score and period_ended', () => {
    for (const { game } of initial.games) {
      const stream = byGame(game)
      expect(stream[0].drive).toBe(0)
      for (const [previous, next] of stream.slice(1).map((event, i) => [stream[i], event])) {
        const closed = previous.kind === 'score' || previous.kind === 'period_ended'
        expect(next.drive - previous.drive).toBe(closed ? 1 : 0)
      }
    }
    expect(events.some((event) => event.drive > 0)).toBe(true)
  })

  it('emits nothing for a game after its game_ended', () => {
    for (const { game } of initial.games) {
      const kinds = byGame(game).map((event) => event.kind)
      expect(kinds.filter((kind) => kind === 'game_ended')).toHaveLength(1)
      expect(kinds.at(-1)).toBe('game_ended')
    }
    let state = final
    for (let i = 0; i < 50; i++) {
      const result = step(state, (state.tick + 1) * TICK_MS)
      expect(result.events).toEqual([])
      state = result.state
    }
  })
})
