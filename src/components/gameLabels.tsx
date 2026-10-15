import { PERIOD_PREFIX, type Game } from '#/domain/game'

function statusLabel(game: Game): string {
  switch (game.status) {
    case 'scheduled':
      return 'Scheduled'
    case 'live':
      return `${PERIOD_PREFIX[game.league]}${game.period}`
    case 'final':
      return 'Final'
  }
}

export function GameStatus({ game }: { game: Game }) {
  return (
    <>
      <span>{game.league}</span>
      <span className={game.status === 'live' ? 'text-red-600' : undefined}>
        {statusLabel(game)}
      </span>
    </>
  )
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
