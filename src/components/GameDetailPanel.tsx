import { useStore } from 'zustand'
import { matchupLabel } from '#/domain/game'
import type { EventId, GameId } from '#/domain/ids'
import type { FeedStore } from '#/feed/store'
import { selectGameDetail } from '#/feed/selectors'
import { DetailPanel, MiniTimeline, RelatedList } from './DetailPanel'
import { GameStatus, oddsCells } from './gameLabels'
import { useSelect } from './useSearchPatch'

export function GameDetailPanel({ store, selected }: { store: FeedStore; selected: GameId }) {
  const detail = useStore(store, (feed) => selectGameDetail(feed, selected))
  const choose = useSelect()
  const select = (id: EventId) => choose({ kind: 'event', id })

  if (detail.kind === 'missing')
    return (
      <DetailPanel
        label="Game details"
        heading={<p className="text-sm text-slate-500">This game is no longer on the board</p>}
      />
    )

  const { game, timeline } = detail
  return (
    <DetailPanel
      label="Game details"
      heading={
        <div>
          <p className="flex gap-2 text-xs font-medium text-slate-500">
            <GameStatus game={game} />
          </p>
          <h2 className="text-lg font-semibold">{matchupLabel(game)}</h2>
        </div>
      }
    >
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1">
        <dt className="truncate text-sm text-slate-600">{game.away.name}</dt>
        <dd className="text-right text-3xl font-bold tabular-nums">{game.score.away}</dd>
        <dt className="truncate text-sm text-slate-600">{game.home.name}</dt>
        <dd className="text-right text-3xl font-bold tabular-nums">{game.score.home}</dd>
      </dl>
      <dl className="grid grid-cols-3 gap-x-2 rounded border border-slate-200 p-2 text-xs">
        {oddsCells(game).map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="truncate text-slate-500">{label}</dt>
            <dd className="truncate text-sm font-semibold text-slate-800 tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <MiniTimeline timeline={timeline} focus={null} game={game} onSelect={select} />
      <RelatedList
        related={detail.recent}
        empty="No events in this game yet"
        game={game}
        onSelect={select}
      />
    </DetailPanel>
  )
}
