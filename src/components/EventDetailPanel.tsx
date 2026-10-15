import { useStore } from 'zustand'
import type { GameEvent } from '#/domain/event'
import { matchupLabel } from '#/domain/game'
import type { EventId } from '#/domain/ids'
import type { FeedStore } from '#/feed/store'
import { RELATED_SCOPES, selectEventDetail, type RelatedScope } from '#/feed/view'
import { describeEvent, eventTime, SEVERITY_STYLE } from './describeEvent'
import { DetailPanel, MiniTimeline, RelatedList } from './DetailPanel'
import { useSearchPatch, useSelect } from './useSearchPatch'

const SCOPE: Readonly<Record<RelatedScope, { readonly label: string; readonly empty: string }>> = {
  game: { label: 'Same game', empty: 'No other events in this game yet' },
  drive: { label: 'Same drive', empty: 'No other events in this drive yet' },
}

const SEVERITY_LABEL: Readonly<Record<GameEvent['severity'], string>> = {
  info: 'Info',
  notable: 'Notable',
  critical: 'Critical',
}

function ScopeToggle({
  scope,
  onChange,
}: {
  scope: RelatedScope
  onChange: (scope: RelatedScope) => void
}) {
  return (
    <div
      role="group"
      aria-label="Related events"
      className="flex rounded border border-slate-300 p-0.5"
    >
      {RELATED_SCOPES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === scope}
          onClick={() => onChange(option)}
          className={`flex-1 rounded px-3 py-1 text-sm font-medium ${option === scope ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          {SCOPE[option].label}
        </button>
      ))}
    </div>
  )
}

export function EventDetailPanel({
  store,
  selected,
  related,
}: {
  store: FeedStore
  selected: EventId
  related: RelatedScope
}) {
  const detail = useStore(store, (feed) => selectEventDetail(feed, selected, related))
  const patch = useSearchPatch()
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
          <span>Drive {event.drive + 1}</span>
        </p>
      </div>
      <MiniTimeline
        timeline={detail.timeline}
        focus={{ event: event.id, driveSpan: detail.driveSpan }}
        game={game}
        onSelect={select}
      />
      <ScopeToggle scope={related} onChange={(scope) => patch({ related: scope })} />
      <RelatedList
        related={detail.related}
        empty={SCOPE[related].empty}
        game={game}
        onSelect={select}
      />
    </DetailPanel>
  )
}
