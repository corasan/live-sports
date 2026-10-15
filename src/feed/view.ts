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
export const RELATED_SCOPES = ['game', 'drive'] as const

export type LeagueFilter = (typeof LEAGUE_FILTERS)[number]
export type GameSort = (typeof GAME_SORT_OPTIONS)[number]
export type EventGrouping = (typeof EVENT_GROUPINGS)[number]
export type RelatedScope = (typeof RELATED_SCOPES)[number]

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

export const DEFAULT_RELATED: RelatedScope = 'game'

export type DriveSpan = { readonly start: number; readonly end: number }

export type EventDetail =
  | { readonly kind: 'missing' }
  | {
      readonly kind: 'found'
      readonly event: GameEvent
      readonly game: Game
      readonly timeline: readonly GameEvent[]
      readonly driveSpan: DriveSpan
      readonly related: readonly GameEvent[]
    }

export type Step = { readonly id: EventId; readonly index: number }

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

const MISSING: EventDetail = { kind: 'missing' }

const IN_SCOPE: Readonly<Record<RelatedScope, (selected: GameEvent, other: GameEvent) => boolean>> =
  {
    game: () => true,
    drive: (selected, other) => other.drive === selected.drive,
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

const eventDetail = memoizeLast(
  (
    events: ReadonlyMap<EventId, GameEvent>,
    order: Ring<EventId>,
    games: ReadonlyMap<GameId, Game>,
    id: EventId,
    scope: RelatedScope,
  ): EventDetail => {
    const event = events.get(id)
    if (event === undefined) return MISSING
    const newestFirst: GameEvent[] = []
    for (let age = 0; age < size(order); age++) {
      const other = eventAt({ events, order }, age)
      if (other.gameId === event.gameId) newestFirst.push(other)
    }
    const inScope = IN_SCOPE[scope]
    const drive = newestFirst.filter((other) => IN_SCOPE.drive(event, other))
    return {
      kind: 'found',
      event,
      game: lookup(games, event.gameId),
      timeline: newestFirst.toReversed(),
      driveSpan: { start: (drive.at(-1) ?? event).ts, end: (drive.at(0) ?? event).ts },
      related: newestFirst.filter((other) => other.id !== event.id && inScope(event, other)),
    }
  },
)

export function selectEventDetail(feed: Feed, id: EventId, scope: RelatedScope): EventDetail {
  return eventDetail(feed.events, feed.order, feed.games, id, scope)
}

export function stepSelection(
  rows: readonly FeedRow[],
  selected: EventId | undefined,
  delta: 1 | -1,
): Step | null {
  const current = selected === undefined ? -1 : rows.findIndex((row) => row.key === selected)
  const direction = current === -1 ? 1 : delta
  for (let index = current + direction; index >= 0 && index < rows.length; index += direction) {
    const row = rows[index]
    if (row.kind === 'event') return { id: row.key, index }
  }
  const stay = rows.at(current)
  return current !== -1 && stay?.kind === 'event' ? { id: stay.key, index: current } : null
}

const newEventCount = memoizeLast(
  (
    feed: Feed,
    snapshotWritten: number,
    league: LeagueFilter,
    severity: Severity,
    q: string,
  ): number => {
    const passes = eventMatcher(feed.games, feed.gameIds, league, severity, q)
    const fresh = Math.min(feed.order.written - snapshotWritten, size(feed.order))
    let count = 0
    for (let age = 0; age < fresh; age++) {
      if (passes(eventAt(feed, age))) count++
    }
    return count
  },
)

export function countNewEvents(live: Feed, snapshot: Feed, query: FeedQuery): number {
  return newEventCount(live, snapshot.order.written, query.league, query.severity, query.q)
}

export type FeedView =
  | { readonly kind: 'loading' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'no-matches' }
  | { readonly kind: 'rows'; readonly rows: readonly FeedRow[] }

const LOADING: FeedView = { kind: 'loading' }
const EMPTY: FeedView = { kind: 'empty' }
const NO_MATCHES: FeedView = { kind: 'no-matches' }

const rowsView = memoizeLast((rows: readonly FeedRow[]): FeedView => ({ kind: 'rows', rows }))

export function selectFeedView(feed: Feed, query: FeedQuery): FeedView {
  if (feed.syncedAt === null) return LOADING
  if (size(feed.order) === 0) return EMPTY
  const rows = selectFeedRows(feed, query)
  return rows.length === 0 ? NO_MATCHES : rowsView(rows)
}

export function clearFilters(query: FeedQuery): FeedQuery {
  const { league, severity, q } = DEFAULT_QUERY
  return { ...query, league, severity, q }
}
