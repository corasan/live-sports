import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react'
import { useStore } from 'zustand'
import type { GameEvent } from '#/domain/event'
import { matchupLabel } from '#/domain/game'
import type { EventId } from '#/domain/ids'
import type { FeedStore } from '#/feed/store'
import { selectFeedRows, stepSelection, type FeedQuery, type FeedRow } from '#/feed/view'
import { describeEvent, eventTime, SEVERITY_STYLE, type Matchup } from './describeEvent'
import { useSelection } from './useSelection'

const ROW_HEIGHT = 44

const OVERSCAN = 12

const SELECTED_STYLE = 'ring-2 ring-sky-500 ring-inset'

const KEY_STEP: ReadonlyMap<string, 1 | -1> = new Map([
  ['ArrowDown', 1],
  ['ArrowUp', -1],
])

const EDITABLE_TAGS: ReadonlySet<string> = new Set(['INPUT', 'SELECT', 'TEXTAREA'])

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && (target.isContentEditable || EDITABLE_TAGS.has(target.tagName))
  )
}

function hasModifier(event: KeyboardEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
}

const EventRow = memo(function EventRow({
  event,
  league,
  home,
  away,
  selected,
  onSelect,
}: { event: GameEvent; selected: boolean; onSelect: (id: EventId) => void } & Matchup) {
  return (
    <button
      type="button"
      aria-current={selected || undefined}
      onClick={() => onSelect(event.id)}
      className={`flex h-full w-full cursor-pointer items-center gap-3 rounded border-l-4 px-3 text-left text-sm whitespace-nowrap ${SEVERITY_STYLE[event.severity]} ${selected ? SELECTED_STYLE : 'hover:brightness-95'}`}
    >
      <time className="text-xs text-slate-400 tabular-nums">{eventTime(event)}</time>
      <span className="text-xs text-slate-500">{matchupLabel({ home, away })}</span>
      <span className="min-w-0 truncate">{describeEvent(event, { league, home, away })}</span>
    </button>
  )
})

function FeedRowView({
  row,
  selected,
  onSelect,
}: {
  row: FeedRow
  selected: EventId | null
  onSelect: (id: EventId) => void
}) {
  if (row.kind === 'event') {
    const { league, home, away } = row.game
    return (
      <EventRow
        event={row.event}
        league={league}
        home={home}
        away={away}
        selected={row.key === selected}
        onSelect={onSelect}
      />
    )
  }
  return (
    <h3 className="flex h-full items-end pb-1 text-sm font-semibold text-slate-700">{row.label}</h3>
  )
}

export function EventFeed({
  store,
  query,
  selected,
}: {
  store: FeedStore
  query: FeedQuery
  selected: EventId | null
}) {
  const rows = useStore(store, (feed) => selectFeedRows(feed, query))
  const { select, close } = useSelection()
  const scrollRef = useRef<HTMLDivElement>(null)
  const getItemKey = useCallback((index: number) => rows[index].key, [rows])
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey,
    overscan: OVERSCAN,
  })

  const previousRows = useRef(rows)
  useLayoutEffect(() => {
    const previous = previousRows.current
    previousRows.current = rows
    const scrollTop = scrollRef.current?.scrollTop ?? 0
    if (previous === rows || scrollTop === 0) return
    const top = Math.floor(scrollTop / ROW_HEIGHT)
    const anchor = previous.at(top)
    if (anchor === undefined) return
    const index = rows.findIndex((row) => row.key === anchor.key)
    if (index !== -1 && index !== top) {
      virtualizer.scrollToOffset(scrollTop + (index - top) * ROW_HEIGHT)
    }
  }, [rows, virtualizer])

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (hasModifier(event) || isTyping(event.target)) return
    const delta = KEY_STEP.get(event.key)
    if (delta !== undefined) {
      const next = stepSelection(rows, selected, delta)
      if (next === null) return
      event.preventDefault()
      select(next)
      virtualizer.scrollToIndex(
        rows.findIndex((row) => row.key === next),
        { align: 'auto' },
      )
    } else if (event.key === 'Escape' && selected !== null) {
      event.preventDefault()
      close()
    }
  })

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (rows.length === 0) return <p className="text-sm text-slate-500">No matching events</p>
  return (
    <div ref={scrollRef} className="h-[60vh] overflow-y-auto">
      <ol className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => (
          <li
            key={item.key}
            className="absolute inset-x-0 top-0 pb-2"
            style={{ height: ROW_HEIGHT, transform: `translateY(${item.start}px)` }}
          >
            <FeedRowView row={rows[item.index]} selected={selected} onSelect={select} />
          </li>
        ))}
      </ol>
    </div>
  )
}
