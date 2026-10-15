import type { GameEvent, Market, Score } from './event'
import type { GameId, TeamId } from './ids'

export const LEAGUES = ['NBA', 'NFL', 'NHL'] as const

export type League = (typeof LEAGUES)[number]

export const PERIOD_PREFIX: Readonly<Record<League, string>> = { NBA: 'Q', NFL: 'Q', NHL: 'P' }

export type Team = { readonly id: TeamId; readonly name: string }

export type Odds = Readonly<Record<Market, number>>

export type GameStatus =
  | { readonly status: 'scheduled' }
  | { readonly status: 'live'; readonly period: number }
  | { readonly status: 'final' }

export type Game = GameStatus & {
  readonly id: GameId
  readonly league: League
  readonly home: Team
  readonly away: Team
  readonly score: Score
  readonly odds: Odds
}

export function matchupLabel(game: Pick<Game, 'home' | 'away'>): string {
  return `${game.away.name} @ ${game.home.name}`
}

export function leaderOf(game: Game, score: Score): TeamId | null {
  if (score.home === score.away) return null
  return score.home > score.away ? game.home.id : game.away.id
}

export function applyEvent(game: Game, event: GameEvent): Game {
  switch (event.kind) {
    case 'game_started':
      return { ...game, status: 'live', period: 1 }
    case 'score':
      return { ...game, score: event.score }
    case 'period_ended':
      return { ...game, status: 'live', period: event.period + 1 }
    case 'odds_shift':
      return { ...game, odds: { ...game.odds, [event.market]: event.to } }
    case 'game_ended':
      return {
        id: game.id,
        league: game.league,
        home: game.home,
        away: game.away,
        odds: game.odds,
        score: event.score,
        status: 'final',
      }
    case 'game_scheduled':
      return event.game
    case 'lead_change':
    case 'injury':
      return game
    default:
      return assertNever(event)
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled event: ${JSON.stringify(value)}`)
}
