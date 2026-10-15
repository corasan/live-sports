import { useVirtualizer } from '@tanstack/react-virtual'
import {
  memo,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useStore } from 'zustand'
import type { GameEvent } from '#/domain/event'
import { matchupLabel } from '#/domain/game'
import type { EventId } from '#/domain/ids'
import type { Feed, Gap } from '#/feed/feed'
import type { FeedStore } from '#/feed/store'
import { clearFilters, type FeedQuery } from '#/feed/query'
import {
  countNewEvents,
  selectFeedView,
  selectHeldView,
  stepSelection,
  type FeedRow,
} from '#/feed/selectors'
import { clockTime, describeEvent, eventTime, SEVERITY_STYLE, type Matchup } from './describeEvent'
import { isPlainKeypress } from './keys'
import { BUTTON, SELECTED_STYLE } from './styles'
import { useSearchPatch, useSelect } from './useSearchPatch'

const ROW_HEIGHT = 44

const OVERSCAN = 12

const SCROLL_THRESHOLD = 1

const SKELETON_ROWS = 8

const NO_ROWS: readonly FeedRow[] = []

type HoldReason = 'paused' | 'scrolled'

type Hold = { readonly snapshot: Feed; readonly reason: HoldReason }

type Mark = { readonly at: number; readonly reason: HoldReason }

const SINCE_LABEL: Readonly<Record<HoldReason, string>> = {
  paused: 'since you paused',
  scrolled: 'since you scrolled away',
}

const KEY_STEP: ReadonlyMap<string, 1 | -1> = new Map([
  ['ArrowDown', 1],
  ['ArrowUp', -1],
])

const EventRow = memo(function EventRow({
  event,
  league,
  home,
  away,
  selected,
  arriving,
  onSelect,
}: {
  event: GameEvent
  selected: boolean
  arriving: boolean
  onSelect: (id: EventId) => void
} & Matchup) {
  const [arrived] = useState(arriving)
  return (
    <button
      type="button"
      aria-current={selected || undefined}
      onClick={() => onSelect(event.id)}
      className={`flex h-full w-full cursor-pointer items-center gap-3 rounded px-3 text-left text-sm whitespace-nowrap ${SEVERITY_STYLE[event.severity]} ${selected ? SELECTED_STYLE : 'hover:brightness-95'} ${arrived ? 'animate-arrive' : ''}`}
    >
      <time className="text-xs text-slate-400 tabular-nums">{eventTime(event)}</time>
      <span className="text-xs text-slate-500">{matchupLabel({ home, away })}</span>
      <span className="min-w-0 truncate">{describeEvent(event, { league, home, away })}</span>
    </button>
  )
})

function missedLabel(missed: number): string {
  return missed === 1 ? '1 event missed' : `${missed} events missed`
}

function GapRow({ gap }: { gap: Gap }) {
  return (
    <p className="flex h-full items-center gap-3 text-xs text-slate-500">
      <span className="flex-1 border-t border-dashed border-slate-300" />
      <span className="tabular-nums">
        Gap · {missedLabel(gap.missed)} · {clockTime(gap.from)}–{clockTime(gap.to)}
      </span>
      <span className="flex-1 border-t border-dashed border-slate-300" />
    </p>
  )
}

function SinceRow({ count, reason }: { count: number; reason: HoldReason }) {
  return (
    <p className="flex h-full items-center gap-3 text-xs font-medium text-sky-700">
      <span className="flex-1 border-t border-sky-400" />
      <span className="tabular-nums">
        {count} new {SINCE_LABEL[reason]}
      </span>
      <span className="flex-1 border-t border-sky-400" />
    </p>
  )
}

function FeedRowView({
  row,
  selected,
  arrivedFrom,
  mark,
  onSelect,
}: {
  row: FeedRow
  selected: EventId | undefined
  arrivedFrom: number
  mark: Mark | null
  onSelect: (id: EventId) => void
}) {
  switch (row.kind) {
    case 'event': {
      const { league, home, away } = row.game
      return (
        <EventRow
          event={row.event}
          league={league}
          home={home}
          away={away}
          selected={row.key === selected}
          arriving={row.seq >= arrivedFrom}
          onSelect={onSelect}
        />
      )
    }
    case 'gap':
      return <GapRow gap={row.gap} />
    case 'since':
      return mark !== null && <SinceRow count={row.count} reason={mark.reason} />
    case 'group':
      return (
        <h3 className="flex h-full items-end pb-1 text-sm font-semibold text-slate-700">
          {row.label}
        </h3>
      )
  }
}

function FeedSkeleton() {
  return (
    <ol aria-busy="true" aria-label="Loading events" className="h-[60vh] overflow-y-auto">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <li key={index} className="pb-2" style={{ height: ROW_HEIGHT }}>
          <div className="flex h-full animate-pulse items-center gap-3 rounded bg-slate-100 px-3">
            <div className="h-3 w-16 rounded bg-slate-200" />
            <div className="h-3 w-28 rounded bg-slate-200" />
            <div className="h-3 w-48 rounded bg-slate-200" />
          </div>
        </li>
      ))}
    </ol>
  )
}

function FeedMessage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1 py-6 text-sm">
      <p className="font-medium text-slate-700">{title}</p>
      {children}
    </div>
  )
}

function NoMatches({ query }: { query: FeedQuery }) {
  const patch = useSearchPatch()
  return (
    <FeedMessage title="No events match these filters">
      <button type="button" onClick={() => patch(clearFilters(query))} className={BUTTON}>
        Clear filters
      </button>
    </FeedMessage>
  )
}

function newEventsLabel(count: number): string {
  return count === 1 ? '1 new event' : `${count} new events`
}

function NewEventsPill({
  store,
  snapshot,
  query,
  onClick,
}: {
  store: FeedStore
  snapshot: Feed
  query: FeedQuery
  onClick: () => void
}) {
  const count = useStore(store, (feed) => countNewEvents(feed, snapshot, query))
  if (count === 0) return null
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white shadow-md hover:bg-slate-700"
    >
      {newEventsLabel(count)}
    </button>
  )
}

export const EventFeed = memo(function EventFeed({
  store,
  query,
  selected,
}: {
  store: FeedStore
  query: FeedQuery
  selected: EventId | undefined
}) {
  const [paused, setPaused] = useState(false)
  const [scrolledAway, setScrolledAway] = useState(false)
  const [hold, setHold] = useState<Hold | null>(null)
  const [mark, setMark] = useState<Mark | null>(null)
  const reason: HoldReason | null = paused ? 'paused' : scrolledAway ? 'scrolled' : null
  if (reason !== null && hold === null) setHold({ snapshot: store.getState(), reason })
  if (reason === null && hold !== null) {
    setMark({ at: hold.snapshot.order.written, reason: hold.reason })
    setHold(null)
  }
  const since = mark?.at ?? null
  const view = useStore(store, (feed) =>
    hold === null
      ? selectFeedView(feed, query, since)
      : selectHeldView(hold.snapshot, query, since),
  )
  const written = useStore(store, (feed) => (hold?.snapshot ?? feed).order.written)
  const [[lastWritten, arrivedFrom], setArrival] = useState([written, written])
  if (written !== lastWritten) setArrival([written, lastWritten])
  const reconnecting = useStore(store, (feed) => feed.connection.kind === 'reconnecting')
  const rows = view.kind === 'rows' ? view.rows : NO_ROWS
  const choose = useSelect()
  const select = useCallback((id: EventId) => choose({ kind: 'event', id }), [choose])
  const scrollRef = useRef<HTMLDivElement>(null)
  const getItemKey = useCallback((index: number) => rows[index].key, [rows])
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey,
    overscan: OVERSCAN,
  })

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const delta = KEY_STEP.get(event.key)
    if (delta === undefined || !isPlainKeypress(event)) return
    const next = stepSelection(rows, selected, delta)
    if (next === null) return
    event.preventDefault()
    select(next.id)
    virtualizer.scrollToIndex(next.index, { align: 'auto' })
  })

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function jumpToLatest() {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    setPaused(false)
  }

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Feed</h2>
          {reconnecting && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">
              Reconnecting…
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setPaused((value) => !value)}
          className={`${BUTTON} text-sm`}
        >
          {paused ? 'Resume feed' : 'Pause feed'}
        </button>
      </div>
      <div className="relative">
        {view.kind === 'loading' ? (
          <FeedSkeleton />
        ) : view.kind === 'empty' ? (
          <FeedMessage title="No events yet">
            <p className="text-slate-500">Events appear here once games tip off.</p>
          </FeedMessage>
        ) : (
          <div
            ref={scrollRef}
            onScroll={(event) => setScrolledAway(event.currentTarget.scrollTop > SCROLL_THRESHOLD)}
            aria-busy={reconnecting || undefined}
            className={`h-[60vh] overflow-y-auto transition-opacity ${reconnecting ? 'opacity-50' : ''}`}
          >
            {view.kind === 'no-matches' ? (
              <NoMatches query={query} />
            ) : (
              <ol className="relative" style={{ height: virtualizer.getTotalSize() }}>
                {virtualizer.getVirtualItems().map((item) => (
                  <li
                    key={item.key}
                    className="absolute inset-x-0 top-0 pb-2"
                    style={{ height: ROW_HEIGHT, transform: `translateY(${item.start}px)` }}
                  >
                    <FeedRowView
                      row={rows[item.index]}
                      selected={selected}
                      arrivedFrom={arrivedFrom}
                      mark={mark}
                      onSelect={select}
                    />
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
        {hold !== null && (
          <NewEventsPill
            store={store}
            snapshot={hold.snapshot}
            query={query}
            onClick={jumpToLatest}
          />
        )}
      </div>
    </section>
  )
})
