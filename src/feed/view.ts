import type { GameEvent, Severity } from '#/domain/event'
import { LEAGUES, matchupLabel, type Game, type GameStatus } from '#/domain/game'
import type { EventId, GameId } from '#/domain/ids'
import { eventAt, lookup, type Feed } from './feed'
import { memoizeLast } from './memo'
import { size, type Ring } from './ring'

export const LEAGUE_FILTERS = ['all', ...LEAGUES] as const
export const SEVERITIES = ['info', 'notable', 'critical'] as const satisfies readonly Severity[]
export const GAME_SORT_OPTIONS = ['schedule', 'closest', 'league'] as const
export const EVENT_GROUPINGS = ['none', 'game', 'league'] as const

export type LeagueFilter = (typeof LEAGUE_FILTERS)[number]
export type GameSort = (typeof GAME_SORT_OPTIONS)[number]
export type EventGrouping = (typeof EVENT_GROUPINGS)[number]

export type FeedQuery = {
  readonly league: LeagueFilter
  readonly severity: Severity
  readonly q: string
  readonly sort: GameSort
  readonly group: EventGrouping
}

export const DEFAULT_QUERY: FeedQuery = {
  league: 'all',
  severity: 'info',
  q: '',
  sort: 'schedule',
  group: 'none',
}

export type FeedRow =
  | { readonly kind: 'group'; readonly key: string; readonly label: string }
  | {
      readonly kind: 'event'
      readonly key: EventId
      readonly event: GameEvent
      readonly game: Game
    }

const SEVERITY_RANK: Readonly<Record<Severity, number>> = {
  info: 0,
  notable: 1,
  critical: 2,
}

const STATUS_RANK: Readonly<Record<GameStatus['status'], number>> = {
  live: 0,
  scheduled: 1,
  final: 2,
}

const margin = (game: Game) => Math.abs(game.score.home - game.score.away)

const GAME_SORTS: Readonly<Record<GameSort, ((a: Game, b: Game) => number) | null>> = {
  schedule: null,
  closest: (a, b) => margin(a) - margin(b) || STATUS_RANK[a.status] - STATUS_RANK[b.status],
  league: (a, b) => a.league.localeCompare(b.league),
}

const GROUPINGS: Readonly<
  Record<EventGrouping, (game: Game) => { readonly key: string; readonly label: string | null }>
> = {
  none: () => ({ key: 'all', label: null }),
  game: (game) => ({ key: game.id, label: matchupLabel(game) }),
  league: (game) => ({ key: game.league, label: game.league }),
}

export function parseOption<T extends string>(
  options: readonly T[],
  raw: string | undefined,
  fallback: T,
): T {
  return options.find((option) => option === raw) ?? fallback
}

export function parseFeedQuery(raw: Readonly<Partial<Record<keyof FeedQuery, string>>>): FeedQuery {
  return {
    league: parseOption(LEAGUE_FILTERS, raw.league, DEFAULT_QUERY.league),
    severity: parseOption(SEVERITIES, raw.severity, DEFAULT_QUERY.severity),
    q: raw.q ?? DEFAULT_QUERY.q,
    sort: parseOption(GAME_SORT_OPTIONS, raw.sort, DEFAULT_QUERY.sort),
    group: parseOption(EVENT_GROUPINGS, raw.group, DEFAULT_QUERY.group),
  }
}

function gameMatcher(league: LeagueFilter, q: string): (game: Game) => boolean {
  const needle = q.trim().toLowerCase()
  return (game) =>
    (league === 'all' || game.league === league) &&
    [game.home.name, game.away.name].some((name) => name.toLowerCase().includes(needle))
}

const visibleGames = memoizeLast(
  (
    games: ReadonlyMap<GameId, Game>,
    gameIds: readonly GameId[],
    league: LeagueFilter,
    q: string,
    sort: GameSort,
  ): readonly Game[] => {
    const visible = gameIds.map((id) => lookup(games, id)).filter(gameMatcher(league, q))
    const compare = GAME_SORTS[sort]
    return compare === null ? visible : visible.toSorted(compare)
  },
)

export function selectVisibleGames(feed: Feed, query: FeedQuery): readonly Game[] {
  return visibleGames(feed.games, feed.gameIds, query.league, query.q, query.sort)
}

function eventMatcher(
  games: ReadonlyMap<GameId, Game>,
  gameIds: readonly GameId[],
  league: LeagueFilter,
  severity: Severity,
  q: string,
): (event: GameEvent) => boolean {
  const matches = gameMatcher(league, q)
  const visible = new Set(gameIds.filter((id) => matches(lookup(games, id))))
  return (event) =>
    SEVERITY_RANK[event.severity] >= SEVERITY_RANK[severity] && visible.has(event.gameId)
}

const feedRows = memoizeLast(
  (
    games: ReadonlyMap<GameId, Game>,
    gameIds: readonly GameId[],
    events: ReadonlyMap<EventId, GameEvent>,
    order: Ring<EventId>,
    league: LeagueFilter,
    severity: Severity,
    q: string,
    group: EventGrouping,
  ): readonly FeedRow[] => {
    const passes = eventMatcher(games, gameIds, league, severity, q)
    const groupOf = GROUPINGS[group]
    const groups = new Map<string, FeedRow[]>()
    for (let age = 0; age < size(order); age++) {
      const event = eventAt({ events, order }, age)
      if (!passes(event)) continue
      const game = lookup(games, event.gameId)
      const { key, label } = groupOf(game)
      let rows = groups.get(key)
      if (rows === undefined) {
        rows = label === null ? [] : [{ kind: 'group', key: `group:${key}`, label }]
        groups.set(key, rows)
      }
      rows.push({ kind: 'event', key: event.id, event, game })
    }
    return [...groups.values()].flat()
  },
)

export function selectFeedRows(feed: Feed, query: FeedQuery): readonly FeedRow[] {
  return feedRows(
    feed.games,
    feed.gameIds,
    feed.events,
    feed.order,
    query.league,
    query.severity,
    query.q,
    query.group,
  )
}

const newEventCount = memoizeLast(
  (
    games: ReadonlyMap<GameId, Game>,
    gameIds: readonly GameId[],
    events: ReadonlyMap<EventId, GameEvent>,
    order: Ring<EventId>,
    snapshotWritten: number,
    league: LeagueFilter,
    severity: Severity,
    q: string,
  ): number => {
    const passes = eventMatcher(games, gameIds, league, severity, q)
    const fresh = Math.min(order.written - snapshotWritten, size(order))
    let count = 0
    for (let age = 0; age < fresh; age++) {
      if (passes(eventAt({ events, order }, age))) count++
    }
    return count
  },
)

export function countNewEvents(live: Feed, snapshot: Feed, query: FeedQuery): number {
  return newEventCount(
    live.games,
    live.gameIds,
    live.events,
    live.order,
    snapshot.order.written,
    query.league,
    query.severity,
    query.q,
  )
}
