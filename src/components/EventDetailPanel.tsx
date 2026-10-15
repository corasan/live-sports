import { useStore } from 'zustand'
import type { GameEvent } from '#/domain/event'
import { matchupLabel } from '#/domain/game'
import type { EventId } from '#/domain/ids'
import type { FeedStore } from '#/feed/store'
import { selectEventDetail } from '#/feed/selectors'
import { describeEvent, eventTime, SEVERITY_STYLE } from './describeEvent'
import { DetailPanel, MiniTimeline, RelatedList } from './DetailPanel'
import { useSelect } from './useSearchPatch'

const SEVERITY_LABEL: Readonly<Record<GameEvent['severity'], string>> = {
  info: 'Info',
  notable: 'Notable',
  critical: 'Critical',
}

export function EventDetailPanel({ store, selected }: { store: FeedStore; selected: EventId }) {
  const detail = useStore(store, (feed) => selectEventDetail(feed, selected))
  const choose = useSelect()
  const select = (id: EventId) => choose({ kind: 'event', id })

  if (detail.kind === 'missing')
    return (
      <DetailPanel
        label="Event details"
        heading={<p className="text-sm text-slate-500">This event is no longer in the feed</p>}
      />
    )

  const { event, game } = detail
  return (
    <DetailPanel
      label="Event details"
      heading={
        <div>
          <p className="text-xs font-medium text-slate-500">{game.league}</p>
          <h2 className="text-lg font-semibold">
            <button
              type="button"
              onClick={() => choose({ kind: 'game', id: game.id })}
              className="cursor-pointer text-left hover:text-sky-700 hover:underline"
            >
              {matchupLabel(game)}
            </button>
          </h2>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <p className={`rounded border-l-4 px-3 py-2 text-sm ${SEVERITY_STYLE[event.severity]}`}>
          {describeEvent(event, game)}
        </p>
        <p className="flex gap-3 text-xs text-slate-500">
          <time className="tabular-nums">{eventTime(event)}</time>
          <span>{SEVERITY_LABEL[event.severity]}</span>
        </p>
      </div>
      <MiniTimeline timeline={detail.timeline} focus={event.id} game={game} onSelect={select} />
      <RelatedList
        related={detail.related}
        empty="No other events in this game yet"
        game={game}
        onSelect={select}
      />
    </DetailPanel>
  )
}
