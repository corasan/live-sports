import { describe, expect, it } from 'vitest'
import type { Game, League } from '#/domain/game'
import { gameId } from '#/domain/ids'
import { ROSTERS } from '#/domain/roster'
import { oddsCells } from './gameLabels'

function game(league: League, spread: number): Game {
  const [home, away] = ROSTERS[league]
  return {
    id: gameId('nba-1'),
    league,
    home,
    away,
    status: 'scheduled',
    score: { home: 0, away: 0 },
    odds: { moneyline: 62, spread, total: 221.5 },
  }
}

function hints(target: Game): readonly string[] {
  return oddsCells(target).map((cell) => cell.hint)
}

describe('oddsCells', () => {
  it('reads a negative spread as the home team favored and a positive one as the underdog', () => {
    const favored = game('NBA', -3.5)
    const underdog = game('NBA', 2)
    expect(hints(favored)[1]).toBe(`${favored.home.name} favored to win by 3.5 points.`)
    expect(hints(underdog)[1]).toBe(
      `${underdog.home.name} are 2-point underdogs; ${underdog.away.name} favored by 2.`,
    )
    expect(hints(game('NBA', 0))[1]).toBe("Pick'em: neither team is favored.")
  })

  it('reads the moneyline as the home win chance and the total as combined score', () => {
    const target = game('NBA', 1)
    expect(hints(target)[0]).toBe(`Betting markets give ${target.home.name} a 62% chance to win.`)
    expect(hints(target)[2]).toBe('Over/under: the expected combined score is 221.5 points.')
  })

  it('counts hockey in goals', () => {
    expect(hints(game('NHL', -1))[1]).toBe(`${ROSTERS.NHL[0].name} favored to win by 1 goal.`)
  })
})
