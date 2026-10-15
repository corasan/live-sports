import { useStore } from 'zustand'
import type { GameEvent } from '#/domain/event'
import { matchupLabel, type Game } from '#/domain/game'
import type { EventId } from '#/domain/ids'
import type { FeedStore } from '#/feed/store'
import { RELATED_SCOPES, selectEventDetail, type RelatedScope } from '#/feed/view'
import { describeEvent, eventTime, SEVERITY_DOT, SEVERITY_STYLE } from './describeEvent'
import { useSelection, type Selection } from './useSelection'

const SCOPE_LABEL: Readonly<Record<RelatedScope, string>> = {
  game: 'Same game',
  drive: 'Same drive',
}

const EMPTY_RELATED: Readonly<Record<RelatedScope, string>> = {
  game: 'No other events in this game yet',
  drive: 'No other events in this drive yet',
}

const SEVERITY_LABEL: Readonly<Record<GameEvent['severity'], string>> = {
  info: 'Info',
  notable: 'Notable',
  critical: 'Critical',
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close details"
      onClick={onClose}
      className="rounded px-2 text-lg leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    >
      ×
    </button>
  )
}

function MiniTimeline({
  timeline,
  event,
  game,
  onSelect,
}: {
  timeline: readonly GameEvent[]
  event: GameEvent
  game: Game
  onSelect: (id: EventId) => void
}) {
  const first = timeline[0].ts
  const span = (timeline.at(-1)?.ts ?? first) - first
  const offset = (ts: number) => (span === 0 ? 50 : ((ts - first) / span) * 100)
  const drive = timeline.filter((other) => other.drive === event.drive).map((other) => other.ts)
  const driveStart = offset(Math.min(...drive))
  return (
    <div className="relative h-8" role="group" aria-label="Game timeline">
      <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
      <div
        className="absolute inset-y-1 min-w-1 -translate-x-0.5 rounded bg-sky-100"
        style={{ left: `${driveStart}%`, width: `${offset(Math.max(...drive)) - driveStart}%` }}
      />
      {timeline.map((other) => {
        const current = other.id === event.id
        const mark =
          other.kind === 'period_ended'
            ? 'h-full w-0.5 bg-slate-400'
            : `size-2.5 rounded-full ${SEVERITY_DOT[other.severity]}`
        return (
          <button
            key={other.id}
            type="button"
            aria-label={describeEvent(other, game)}
            aria-current={current || undefined}
            onClick={() => onSelect(other.id)}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer ${mark} ${current ? 'z-10 scale-150 ring-2 ring-sky-500' : ''}`}
            style={{ left: `${offset(other.ts)}%` }}
          />
        )
      })}
    </div>
  )
}

function RelatedList({
  related,
  scope,
  game,
  onSelect,
}: {
  related: readonly GameEvent[]
  scope: RelatedScope
  game: Game
  onSelect: (id: EventId) => void
}) {
  if (related.length === 0) return <p className="text-sm text-slate-500">{EMPTY_RELATED[scope]}</p>
  return (
    <ul className="flex max-h-[40vh] flex-col gap-1 overflow-y-auto">
      {related.map((event) => (
        <li key={event.id}>
          <button
            type="button"
            onClick={() => onSelect(event.id)}
            className={`flex w-full cursor-pointer items-center gap-3 rounded border-l-4 px-3 py-2 text-left text-sm hover:brightness-95 ${SEVERITY_STYLE[event.severity]}`}
          >
            <time className="text-xs text-slate-400 tabular-nums">{eventTime(event)}</time>
            <span className="min-w-0 truncate">{describeEvent(event, game)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function ScopeToggle({ scope, onChange }: { scope: RelatedScope; onChange: Selection['scope'] }) {
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
          {SCOPE_LABEL[option]}
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
  const selection = useSelection()
  return (
    <aside
      aria-label="Event details"
      className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6"
    >
      {detail.kind === 'missing' ? (
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-slate-500">This event is no longer in the feed</p>
          <CloseButton onClose={selection.close} />
        </div>
      ) : (
        <>
          <header className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500">{detail.game.league}</p>
                <h2 className="text-lg font-semibold">{matchupLabel(detail.game)}</h2>
              </div>
              <CloseButton onClose={selection.close} />
            </div>
            <p
              className={`rounded border-l-4 px-3 py-2 text-sm ${SEVERITY_STYLE[detail.event.severity]}`}
            >
              {describeEvent(detail.event, detail.game)}
            </p>
            <p className="flex gap-3 text-xs text-slate-500">
              <time className="tabular-nums">{eventTime(detail.event)}</time>
              <span>{SEVERITY_LABEL[detail.event.severity]}</span>
              <span>Drive {detail.event.drive + 1}</span>
            </p>
          </header>
          <MiniTimeline
            timeline={detail.timeline}
            event={detail.event}
            game={detail.game}
            onSelect={selection.select}
          />
          <ScopeToggle scope={related} onChange={selection.scope} />
          <RelatedList
            related={detail.related}
            scope={related}
            game={detail.game}
            onSelect={selection.select}
          />
        </>
      )}
    </aside>
  )
}
