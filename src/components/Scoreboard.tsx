import { memo, useId } from 'react'
import { useStore } from 'zustand'
import type { Game } from '#/domain/game'
import type { GameId } from '#/domain/ids'
import type { FeedStore } from '#/feed/store'
import type { FeedQuery } from '#/feed/query'
import { selectVisibleGames } from '#/feed/selectors'
import { GameStatus, oddsCells } from './gameLabels'
import { SELECTED_CARD } from './styles'
import { columnAlign, Term } from './Term'
import { useSelect } from './useSearchPatch'

const GRID = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4'
const CARD = 'rounded-lg border p-3 shadow-sm'
const IDLE_CARD = 'border-slate-200 bg-white'
const HEADER = 'flex h-4 items-center justify-between text-xs leading-4'
const TEAMS = 'mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 text-sm leading-5'
const ODDS = 'mt-2 grid grid-cols-3 gap-x-2 text-xs leading-4'
const BONE = 'rounded bg-slate-200'

function ScoreboardSkeleton({ store }: { store: FeedStore }) {
  const count = useStore(store, (feed) => feed.gameIds.length)
  return (
    <ul aria-busy="true" aria-label="Loading games" className={GRID}>
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className={`${CARD} ${IDLE_CARD} animate-pulse`}>
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

function GameCard({
  game,
  current,
  onSelect,
}: {
  game: Game
  current: boolean
  onSelect: () => void
}) {
  const hints = useId()
  const cells = oddsCells(game)
  const hintId = (index: number) => `${hints}-${index}`
  return (
    <button
      type="button"
      aria-current={current || undefined}
      aria-describedby={cells.map((_, index) => hintId(index)).join(' ')}
      onClick={onSelect}
      className={`${CARD} block w-full cursor-pointer text-left ${current ? SELECTED_CARD : `${IDLE_CARD} hover:border-slate-300`}`}
    >
      <span className={`${HEADER} font-medium whitespace-nowrap text-slate-500`}>
        <GameStatus game={game} />
      </span>
      <span className={TEAMS}>
        <span className="truncate">{game.away.name}</span>
        <span className="text-right font-semibold tabular-nums">{game.score.away}</span>
        <span className="truncate">{game.home.name}</span>
        <span className="text-right font-semibold tabular-nums">{game.score.home}</span>
      </span>
      <span className={ODDS}>
        {cells.map(({ label, value, hint }, index) => (
          <span key={label} className="flex min-w-0 flex-col text-slate-500">
            <Term
              id={hintId(index)}
              label={label}
              hint={hint}
              align={columnAlign(index, cells.length)}
              focusable={false}
            />
            <span className="truncate font-medium text-slate-700 tabular-nums">{value}</span>
          </span>
        ))}
      </span>
    </button>
  )
}

export const Scoreboard = memo(function Scoreboard({
  store,
  query,
  selected,
}: {
  store: FeedStore
  query: FeedQuery
  selected: GameId | undefined
}) {
  const games = useStore(store, (feed) =>
    feed.syncedAt === null ? null : selectVisibleGames(feed, query),
  )
  const select = useSelect()
  if (games === null) return <ScoreboardSkeleton store={store} />
  if (games.length === 0) return <p className="text-sm text-slate-500">No matching games</p>
  return (
    <ul className={GRID}>
      {games.map((game) => (
        <li key={game.id}>
          <GameCard
            game={game}
            current={game.id === selected}
            onSelect={() => select({ kind: 'game', id: game.id })}
          />
        </li>
      ))}
    </ul>
  )
})
