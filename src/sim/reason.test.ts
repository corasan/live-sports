import { describe, expect, it } from 'vitest'
import type { Score } from '#/domain/event'
import type { Game, GameStatus } from '#/domain/game'
import { gameId } from '#/domain/ids'
import { ROSTERS } from '#/domain/roster'
import { LEAGUE_RULES } from './leagues'
import { reasonFor } from './reason'

const RULES = LEAGUE_RULES.NBA
const [HOME, AWAY] = ROSTERS.NBA
const EARLY: GameStatus = { status: 'live', period: 1 }
const LATE: GameStatus = { status: 'live', period: RULES.periods }

const shift = (to: number) => ({ kind: 'odds_shift', market: 'spread', from: 0, to }) as const

function game(status: GameStatus, score: Score): Game {
  return {
    ...status,
    id: gameId('nba-1'),
    league: 'NBA',
    home: HOME,
    away: AWAY,
    score,
    odds: { moneyline: 50, spread: 0, total: 220 },
  }
}

describe('reasonFor', () => {
  const trailing = { home: 10, away: 12 }
  const goAhead = {
    kind: 'score',
    teamId: HOME.id,
    points: 3,
    score: { home: 13, away: 12 },
  } as const

  it('calls a go-ahead score late only in the final period', () => {
    expect(reasonFor(goAhead, game(EARLY, trailing), RULES)).toBe('go_ahead')
    expect(reasonFor(goAhead, game(LATE, trailing), RULES)).toBe('late_go_ahead')
  })

  it('treats a score that only ties or extends a lead as routine, even late', () => {
    const tying = {
      kind: 'score',
      teamId: HOME.id,
      points: 2,
      score: { home: 12, away: 12 },
    } as const
    const extending = { ...goAhead, score: { home: 16, away: 12 } }
    expect(reasonFor(tying, game(LATE, trailing), RULES)).toBe('routine')
    expect(reasonFor(extending, game(LATE, { home: 13, away: 12 }), RULES)).toBe('routine')
  })

  it('calls a lead change late only in the final period', () => {
    const change = { kind: 'lead_change', leader: HOME.id } as const
    expect(reasonFor(change, game(EARLY, trailing), RULES)).toBe('lead_change')
    expect(reasonFor(change, game(LATE, trailing), RULES)).toBe('late_lead_change')
  })

  it("moves the line only once a shift reaches the market's notable threshold", () => {
    const { notableShift, unit } = RULES.markets.spread
    const before = game(EARLY, trailing)
    expect(reasonFor(shift(notableShift - unit), before, RULES)).toBe('routine')
    expect(reasonFor(shift(-notableShift), before, RULES)).toBe('line_move')
  })
})
