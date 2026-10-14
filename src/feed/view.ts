import type { GameEvent, Severity } from '#/domain/event'
import type { Game, GameStatus, League } from '#/domain/game'
import type { EventId, GameId } from '#/domain/ids'
import { eventAt, lookup, type Feed } from './feed'
import { memoizeLast } from './memo'
import { size, type Ring } from './ring'

export type LeagueFilter = League | 'all'
export type GameSort = 'schedule' | 'closest' | 'league'
export type EventGrouping = 'none' | 'game' | 'league'

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

type FeedEntry = { readonly event: GameEvent; readonly game: Game }

export type FeedRow =
  | { readonly kind: 'group'; readonly key: string; readonly label: string }
  | ({ readonly kind: 'event'; readonly key: EventId } & FeedEntry)

type GameComparator = (a: Game, b: Game) => number

type GroupKey = { readonly key: string; readonly label: string | null }

export const LEAGUE_FILTERS = [
  'all',
  'NBA',
  'NFL',
  'NHL',
] as const satisfies readonly LeagueFilter[]
export const SEVERITIES = ['info', 'notable', 'critical'] as const satisfies readonly Severity[]
export const GAME_SORT_OPTIONS = [
  'schedule',
  'closest',
  'league',
] as const satisfies readonly GameSort[]
export const EVENT_GROUPINGS = [
  'none',
  'game',
  'league',
] as const satisfies readonly EventGrouping[]

export const SEVERITY_RANK: Readonly<Record<Severity, number>> = {
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

export const GAME_SORTS: Readonly<Record<GameSort, GameComparator | null>> = {
  schedule: null,
  closest: (a, b) => margin(a) - margin(b) || STATUS_RANK[a.status] - STATUS_RANK[b.status],
  league: (a, b) => a.league.localeCompare(b.league),
}

export const GROUPINGS: Readonly<Record<EventGrouping, (game: Game) => GroupKey>> = {
  none: () => ({ key: 'all', label: null }),
  game: (game) => ({ key: game.id, label: `${game.away.name} @ ${game.home.name}` }),
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

const feedRows = memoizeLast(
  (
    games: ReadonlyMap<GameId, Game>,
    events: ReadonlyMap<EventId, GameEvent>,
    order: Ring<EventId>,
    league: LeagueFilter,
    severity: Severity,
    q: string,
    group: EventGrouping,
  ): readonly FeedRow[] => {
    const matches = gameMatcher(league, q)
    const groupOf = GROUPINGS[group]
    const groups = new Map<string, { label: string | null; entries: FeedEntry[] }>()
    for (let age = 0; age < size(order); age++) {
      const event = eventAt({ events, order }, age)
      const game = lookup(games, event.gameId)
      if (SEVERITY_RANK[event.severity] < SEVERITY_RANK[severity] || !matches(game)) continue
      const { key, label } = groupOf(game)
      const existing = groups.get(key)
      if (existing === undefined) groups.set(key, { label, entries: [{ event, game }] })
      else existing.entries.push({ event, game })
    }
    const rows: FeedRow[] = []
    for (const [key, { label, entries }] of groups) {
      if (label !== null) rows.push({ kind: 'group', key: `group:${key}`, label })
      for (const entry of entries) rows.push({ kind: 'event', key: entry.event.id, ...entry })
    }
    return rows
  },
)

export function selectFeedRows(feed: Feed, query: FeedQuery): readonly FeedRow[] {
  return feedRows(
    feed.games,
    feed.events,
    feed.order,
    query.league,
    query.severity,
    query.q,
    query.group,
  )
}
