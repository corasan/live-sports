import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useCallback, useRef, useState } from 'react'
import { useStore } from 'zustand'
import type { GameEvent, Market, Severity } from '#/domain/event'
import { matchupLabel, type Game } from '#/domain/game'
import type { TeamId } from '#/domain/ids'
import type { FeedStore } from '#/feed/store'
import { countNewEvents, selectFeedRows, type FeedQuery, type FeedRow } from '#/feed/view'
import { PERIOD_PREFIX } from './Scoreboard'

const ROW_HEIGHT = 44

const OVERSCAN = 12

const SCROLL_THRESHOLD = 1

type Matchup = Pick<Game, 'league' | 'home' | 'away'>

const SEVERITY_STYLE: Readonly<Record<Severity, string>> = {
  info: 'border-slate-200 text-slate-600',
  notable: 'border-amber-400 bg-amber-50 text-slate-900',
  critical: 'border-red-500 bg-red-50 font-semibold text-red-900',
}

const MARKET_LABEL: Readonly<Record<Market, string>> = {
  moneyline: 'Home win %',
  spread: 'Spread',
  total: 'Total',
}

function teamName(matchup: Matchup, id: TeamId): string {
  return id === matchup.home.id ? matchup.home.name : matchup.away.name
}

function describeEvent(event: GameEvent, matchup: Matchup): string {
  switch (event.kind) {
    case 'game_started':
      return 'Game started'
    case 'score':
      return `${teamName(matchup, event.teamId)} +${event.points} (${event.score.away}-${event.score.home})`
    case 'lead_change':
      return `${teamName(matchup, event.leader)} take the lead`
    case 'period_ended':
      return `End of ${PERIOD_PREFIX[matchup.league]}${event.period}`
    case 'injury':
      return `${event.player} (${teamName(matchup, event.teamId)}) injured`
    case 'odds_shift':
      return `${MARKET_LABEL[event.market]} ${event.from} → ${event.to}`
    case 'game_ended':
      return `Final ${event.score.away}-${event.score.home}`
  }
}

const EventRow = memo(function EventRow({
  event,
  league,
  home,
  away,
}: { event: GameEvent } & Matchup) {
  return (
    <div
      className={`flex h-full items-center gap-3 rounded border-l-4 px-3 text-sm whitespace-nowrap ${SEVERITY_STYLE[event.severity]}`}
    >
      <time className="text-xs text-slate-400 tabular-nums">
        {new Date(event.ts).toLocaleTimeString()}
      </time>
      <span className="text-xs text-slate-500">{matchupLabel({ home, away })}</span>
      <span className="min-w-0 truncate">{describeEvent(event, { league, home, away })}</span>
    </div>
  )
})

function FeedRowView({ row }: { row: FeedRow }) {
  if (row.kind === 'event') {
    const { league, home, away } = row.game
    return <EventRow event={row.event} league={league} home={home} away={away} />
  }
  return (
    <h3 className="flex h-full items-end pb-1 text-sm font-semibold text-slate-700">{row.label}</h3>
  )
}

function useHeld<T>(value: T, held: boolean): T | null {
  const [snapshot, setSnapshot] = useState<T | null>(null)
  if (held && snapshot === null) {
    setSnapshot(value)
    return value
  }
  if (!held && snapshot !== null) {
    setSnapshot(null)
    return null
  }
  return snapshot
}

function newEventsLabel(count: number): string {
  return count === 1 ? '1 new event' : `${count} new events`
}

export function EventFeed({
  store,
  query,
  paused,
  onResume,
}: {
  store: FeedStore
  query: FeedQuery
  paused: boolean
  onResume: () => void
}) {
  const live = useStore(store)
  const [scrolledAway, setScrolledAway] = useState(false)
  const snapshot = useHeld(live, paused || scrolledAway)
  const rows = selectFeedRows(snapshot ?? live, query)
  const newEvents = snapshot === null ? 0 : countNewEvents(live, snapshot, query)
  const scrollRef = useRef<HTMLDivElement>(null)
  const getItemKey = useCallback((index: number) => rows[index].key, [rows])
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey,
    overscan: OVERSCAN,
  })

  function jumpToLatest() {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    setScrolledAway(false)
    onResume()
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={(event) => setScrolledAway(event.currentTarget.scrollTop > SCROLL_THRESHOLD)}
        className="h-[60vh] overflow-y-auto"
      >
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No matching events</p>
        ) : (
          <ol className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => (
              <li
                key={item.key}
                className="absolute inset-x-0 top-0 pb-2"
                style={{ height: ROW_HEIGHT, transform: `translateY(${item.start}px)` }}
              >
                <FeedRowView row={rows[item.index]} />
              </li>
            ))}
          </ol>
        )}
      </div>
      {newEvents > 0 && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white shadow-md hover:bg-slate-700"
        >
          {newEventsLabel(newEvents)}
        </button>
      )}
    </div>
  )
}
