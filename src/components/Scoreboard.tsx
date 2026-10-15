import { useStore } from 'zustand'
import { PERIOD_PREFIX, type Game } from '#/domain/game'
import type { FeedStore } from '#/feed/store'
import { selectVisibleGames, type FeedQuery } from '#/feed/view'

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

function oddsCells(game: Game): readonly (readonly [label: string, value: string])[] {
  return [
    ['Home win', `${game.odds.moneyline}%`],
    ['Spread', signed(game.odds.spread)],
    ['O/U', `${game.odds.total}`],
  ]
}

const GRID = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4'
const CARD = 'rounded-lg border border-slate-200 bg-white p-3 shadow-sm'
const HEADER = 'flex h-4 items-center justify-between text-xs leading-4'
const TEAMS = 'mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 text-sm leading-5'
const ODDS = 'mt-2 grid grid-cols-3 gap-x-2 text-xs leading-4'
const BONE = 'rounded bg-slate-200'

function ScoreboardSkeleton({ store }: { store: FeedStore }) {
  const count = useStore(store, (feed) => feed.gameIds.length)
  return (
    <ul aria-busy="true" aria-label="Loading games" className={GRID}>
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className={`${CARD} animate-pulse`}>
          <div className={HEADER}>
            <div className={`h-3 w-8 ${BONE}`} />
            <div className={`h-3 w-6 ${BONE}`} />
          </div>
          <div className={TEAMS}>
            <div className={`my-1 h-3 w-3/4 ${BONE}`} />
            <div className={`my-1 h-3 w-4 ${BONE}`} />
            <div className={`my-1 h-3 w-2/3 ${BONE}`} />
            <div className={`my-1 h-3 w-4 ${BONE}`} />
          </div>
          <div className={ODDS}>
            {[0, 1, 2].map((cell) => (
              <div key={cell} className="flex flex-col">
                <div className={`my-0.5 h-3 w-3/4 ${BONE}`} />
                <div className={`my-0.5 h-3 w-1/2 ${BONE}`} />
              </div>
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}

export function Scoreboard({ store, query }: { store: FeedStore; query: FeedQuery }) {
  const games = useStore(store, (feed) =>
    feed.syncedAt === null ? null : selectVisibleGames(feed, query),
  )
  if (games === null) return <ScoreboardSkeleton store={store} />
  if (games.length === 0) return <p className="text-sm text-slate-500">No matching games</p>
  return (
    <ul className={GRID}>
      {games.map((game) => (
        <li key={game.id} className={CARD}>
          <div className={`${HEADER} font-medium whitespace-nowrap text-slate-500`}>
            <span>{game.league}</span>
            <span className={game.status === 'live' ? 'text-red-600' : undefined}>
              {statusLabel(game)}
            </span>
          </div>
          <dl className={TEAMS}>
            <dt className="truncate">{game.away.name}</dt>
            <dd className="text-right font-semibold tabular-nums">{game.score.away}</dd>
            <dt className="truncate">{game.home.name}</dt>
            <dd className="text-right font-semibold tabular-nums">{game.score.home}</dd>
          </dl>
          <dl className={ODDS}>
            {oddsCells(game).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="truncate text-slate-500">{label}</dt>
                <dd className="truncate font-medium text-slate-700 tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  )
}
