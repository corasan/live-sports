import { useId } from 'react'
import { useStore } from 'zustand'
import { matchupLabel } from '#/domain/game'
import type { EventId } from '#/domain/ids'
import type { Selection } from '#/feed/selection'
import type { FeedStore } from '#/feed/store'
import { selectDetail } from '#/feed/selectors'
import { DetailPanel, EventList, MiniTimeline } from './DetailPanel'
import { GameStatus, oddsCells } from './gameLabels'
import { columnAlign, Term } from './Term'
import { useSelect } from './useSearchPatch'

const MISSING: Readonly<Record<Selection['kind'], string>> = {
  event: 'This event is no longer in the feed',
  game: 'This game is no longer on the board',
}

export function GameDetailPanel({ store, selection }: { store: FeedStore; selection: Selection }) {
  const detail = useStore(store, (feed) => selectDetail(feed, selection))
  const choose = useSelect()
  const select = (id: EventId) => choose({ kind: 'event', id })
  const hints = useId()

  if (detail.kind === 'missing')
    return (
      <DetailPanel
        label="Game details"
        heading={<p className="text-sm text-slate-500">{MISSING[selection.kind]}</p>}
      />
    )

  const { game, timeline, recent, focus } = detail
  const cells = oddsCells(game)
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
        {cells.map(({ label, value, hint }, index) => (
          <div key={label} className="min-w-0">
            <dt className="text-slate-500">
              <Term
                id={`${hints}-${index}`}
                label={label}
                hint={hint}
                align={columnAlign(index, cells.length)}
                focusable
              />
            </dt>
            <dd className="truncate text-sm font-semibold text-slate-800 tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <MiniTimeline timeline={timeline} focus={focus} game={game} onSelect={select} />
      <EventList events={recent} focus={focus} game={game} onSelect={select} />
    </DetailPanel>
  )
}
