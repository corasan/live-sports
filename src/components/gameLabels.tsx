import type { Market, Moment } from '#/domain/event'
import { PERIOD_PREFIX, type Game, type League } from '#/domain/game'

export function statusLabel(league: League, moment: Moment): string {
  switch (moment.status) {
    case 'scheduled':
      return 'Scheduled'
    case 'live':
      return `${PERIOD_PREFIX[league]}${moment.period}`
    case 'final':
      return 'Final'
  }
}

export function GameStatus({ game }: { game: Game }) {
  return (
    <>
      <span>{game.league}</span>
      <span className={game.status === 'live' ? 'text-red-600' : undefined}>
        {statusLabel(game.league, game)}
      </span>
    </>
  )
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`
}

export function marketDelta(market: Market, from: number, to: number): string {
  const delta = signed(to - from)
  return market === 'moneyline' ? `${delta}%` : delta
}

const SCORE_UNIT: Readonly<Record<League, { readonly one: string; readonly many: string }>> = {
  NBA: { one: 'point', many: 'points' },
  NFL: { one: 'point', many: 'points' },
  NHL: { one: 'goal', many: 'goals' },
}

function unit(game: Game, amount: number): string {
  const { one, many } = SCORE_UNIT[game.league]
  return amount === 1 ? one : many
}

function spreadHint(game: Game): string {
  const { home, away } = game
  const line = game.odds.spread
  const margin = Math.abs(line)
  if (line < 0) return `${home.name} favored to win by ${margin} ${unit(game, margin)}.`
  if (line > 0)
    return `${home.name} are ${margin}-${unit(game, 1)} underdogs; ${away.name} favored by ${margin}.`
  return `Pick'em: neither team is favored.`
}

export type OddsCell = { readonly label: string; readonly value: string; readonly hint: string }

const ODDS_CELLS: Readonly<Record<Market, (game: Game) => OddsCell>> = {
  moneyline: (game) => ({
    label: 'Home win',
    value: `${game.odds.moneyline}%`,
    hint: `Betting markets give ${game.home.name} a ${game.odds.moneyline}% chance to win.`,
  }),
  spread: (game) => ({
    label: 'Spread',
    value: signed(game.odds.spread),
    hint: spreadHint(game),
  }),
  total: (game) => ({
    label: 'O/U',
    value: `${game.odds.total}`,
    hint: `Over/under: the expected combined score is ${game.odds.total} ${unit(game, game.odds.total)}.`,
  }),
}

export function oddsCells(game: Game): readonly OddsCell[] {
  return Object.values(ODDS_CELLS).map((cell) => cell(game))
}
