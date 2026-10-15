import { PERIOD_PREFIX, type Game } from '#/domain/game'

export function statusLabel(game: Game): string {
  switch (game.status) {
    case 'scheduled':
      return 'Scheduled'
    case 'live':
      return `${PERIOD_PREFIX[game.league]}${game.period}`
    case 'final':
      return 'Final'
  }
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`
}

export function oddsCells(game: Game): readonly (readonly [label: string, value: string])[] {
  return [
    ['Home win', `${game.odds.moneyline}%`],
    ['Spread', signed(game.odds.spread)],
    ['O/U', `${game.odds.total}`],
  ]
}
