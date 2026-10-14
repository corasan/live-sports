import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/shallow'
import type { GameEvent, Market, Severity } from '#/domain/event'
import type { Game } from '#/domain/game'
import type { GameId, TeamId } from '#/domain/ids'
import { eventAt, gamesOf } from '#/feed/feed'
import { at, size } from '#/feed/ring'
import type { FeedStore } from '#/feed/store'
import { PERIOD_PREFIX } from './Scoreboard'

const ROW_HEIGHT = 44

const OVERSCAN = 12

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

function matchupsOf(store: FeedStore): ReadonlyMap<GameId, Matchup> {
  return new Map(
    gamesOf(store.getState()).map(({ id, league, home, away }) => [id, { league, home, away }]),
  )
}

const FeedRow = memo(function FeedRow({ event, matchup }: { event: GameEvent; matchup: Matchup }) {
  return (
    <div
      className={`flex h-full items-center gap-3 rounded border-l-4 px-3 text-sm whitespace-nowrap ${SEVERITY_STYLE[event.severity]}`}
    >
      <time className="text-xs text-slate-400 tabular-nums">
        {new Date(event.ts).toLocaleTimeString()}
      </time>
      <span className="text-xs text-slate-500">
        {matchup.away.name} @ {matchup.home.name}
      </span>
      <span className="min-w-0 truncate">{describeEvent(event, matchup)}</span>
    </div>
  )
})

export function EventFeed({ store }: { store: FeedStore }) {
  const log = useStore(
    store,
    useShallow(({ order, events }) => ({ order, events })),
  )
  const matchups = useMemo(() => matchupsOf(store), [store])
  const scrollRef = useRef<HTMLDivElement>(null)
  const getItemKey = useCallback((index: number) => at(log.order, index), [log.order])
  const virtualizer = useVirtualizer({
    count: size(log.order),
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey,
    overscan: OVERSCAN,
  })

  const { written } = log.order
  const previousWritten = useRef(written)
  useLayoutEffect(() => {
    const prepended = written - previousWritten.current
    previousWritten.current = written
    const scrollTop = scrollRef.current?.scrollTop ?? 0
    if (prepended > 0 && scrollTop > 0) {
      virtualizer.scrollToOffset(scrollTop + prepended * ROW_HEIGHT)
    }
  }, [written, virtualizer])

  return (
    <div ref={scrollRef} className="h-[60vh] overflow-y-auto">
      <ol className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const event = eventAt(log, item.index)
          const matchup = matchups.get(event.gameId)
          if (matchup === undefined) return null
          return (
            <li
              key={item.key}
              className="absolute inset-x-0 top-0 pb-2"
              style={{ height: ROW_HEIGHT, transform: `translateY(${item.start}px)` }}
            >
              <FeedRow event={event} matchup={matchup} />
            </li>
          )
        })}
      </ol>
    </div>
  )
}
