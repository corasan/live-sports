import { useStore } from 'zustand'
import { useShallow } from 'zustand/shallow'
import type { Game, League } from '#/domain/game'
import { gamesOf } from '#/feed/feed'
import type { FeedStore } from '#/feed/store'

export const PERIOD_PREFIX: Readonly<Record<League, string>> = { NBA: 'Q', NFL: 'Q', NHL: 'P' }

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

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`
}

export function Scoreboard({ store }: { store: FeedStore }) {
  const games = useStore(store, useShallow(gamesOf))
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {games.map((game) => (
        <li key={game.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex justify-between text-xs font-medium text-slate-500">
            <span>{game.league}</span>
            <span className={game.status === 'live' ? 'text-red-600' : undefined}>
              {statusLabel(game)}
            </span>
          </div>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1 text-sm">
            <dt>{game.away.name}</dt>
            <dd className="text-right font-semibold tabular-nums">{game.score.away}</dd>
            <dt>{game.home.name}</dt>
            <dd className="text-right font-semibold tabular-nums">{game.score.home}</dd>
          </dl>
          <p className="mt-2 text-xs text-slate-500 tabular-nums">
            Home win {game.odds.moneyline}% · Spread {signed(game.odds.spread)} · O/U{' '}
            {game.odds.total}
          </p>
        </li>
      ))}
    </ul>
  )
}
