import type { GameEvent, Severity } from '#/domain/event'
import { matchupLabel, type Game, type GameStatus, type League, type Team } from '#/domain/game'
import { parseEventId, parseGameId, type EventId, type GameId, type TeamId } from '#/domain/ids'
import { ROSTER, ROSTERS } from '#/domain/roster'
import { eventAt, lookup, type Feed, type Gap } from './feed'
import { memoizeLast } from './memo'
import { at, size, type Ring } from './ring'

export const SEVERITIES = ['info', 'notable', 'critical'] as const satisfies readonly Severity[]
export const GAME_SORT_OPTIONS = ['schedule', 'closest', 'league'] as const
export const EVENT_GROUPINGS = ['none', 'game', 'league'] as const
export const RELATED_SCOPES = ['game', 'drive'] as const

export type GameSort = (typeof GAME_SORT_OPTIONS)[number]
export type EventGrouping = (typeof EVENT_GROUPINGS)[number]
export type RelatedScope = (typeof RELATED_SCOPES)[number]

export type FeedQuery = {
  readonly teams: readonly TeamId[]
  readonly severity: Severity
  readonly q: string
  readonly sort: GameSort
  readonly group: EventGrouping
}

export const DEFAULT_QUERY: FeedQuery = {
  teams: [],
  severity: 'info',
  q: '',
  sort: 'schedule',
  group: 'none',
}

export const DEFAULT_RELATED: RelatedScope = 'game'

export type DriveSpan = { readonly start: number; readonly end: number }

export type Selection =
  | { readonly kind: 'event'; readonly id: EventId }
  | { readonly kind: 'game'; readonly id: GameId }

export type SelectionSearch = {
  readonly event: EventId | undefined
  readonly game: GameId | undefined
}

type Missing = { readonly kind: 'missing' }

export type EventDetail =
  | Missing
  | {
      readonly kind: 'found'
      readonly event: GameEvent
      readonly game: Game
      readonly timeline: readonly GameEvent[]
      readonly driveSpan: DriveSpan
      readonly related: readonly GameEvent[]
    }

export type GameDetail =
  | Missing
  | {
      readonly kind: 'found'
      readonly game: Game
      readonly timeline: readonly GameEvent[]
      readonly recent: readonly GameEvent[]
    }

export type Step = { readonly id: EventId; readonly index: number }

export type FeedRow =
  | { readonly kind: 'group'; readonly key: string; readonly label: string }
  | {
      readonly kind: 'event'
      readonly key: EventId
      readonly seq: number
      readonly event: GameEvent
      readonly game: Game
    }
  | { readonly kind: 'gap'; readonly key: string; readonly gap: Gap }
  | { readonly kind: 'since'; readonly key: string; readonly count: number }

type Section = {
  readonly key: string
  readonly rows: FeedRow[]
  pending: number
  fresh: number
  marked: boolean
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

const MISSING: Missing = { kind: 'missing' }

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

type RawFeedQuery = Readonly<
  Partial<Record<Exclude<keyof FeedQuery, 'teams'>, string>> & { teams?: unknown }
>

export function parseFeedQuery(raw: RawFeedQuery): FeedQuery {
  return {
    teams: Array.isArray(raw.teams) ? normalizeTeams(raw.teams) : DEFAULT_QUERY.teams,
    severity: parseOption(SEVERITIES, raw.severity, DEFAULT_QUERY.severity),
    q: raw.q ?? DEFAULT_QUERY.q,
    sort: parseOption(GAME_SORT_OPTIONS, raw.sort, DEFAULT_QUERY.sort),
    group: parseOption(EVENT_GROUPINGS, raw.group, DEFAULT_QUERY.group),
  }
}

type LeagueSelection = 'all' | 'some' | 'none'

function normalizeTeams(ids: Iterable<unknown>): readonly TeamId[] {
  const wanted = new Set(ids)
  return ROSTER.filter((team) => wanted.has(team.id)).map((team) => team.id)
}

export function pickedTeams(teams: readonly TeamId[], league: League): readonly Team[] {
  return ROSTERS[league].filter((team) => teams.includes(team.id))
}

export function leagueSelection(teams: readonly TeamId[], league: League): LeagueSelection {
  const picked = pickedTeams(teams, league).length
  if (picked === 0) return 'none'
  return picked === ROSTERS[league].length ? 'all' : 'some'
}

export function toggleTeam(teams: readonly TeamId[], id: TeamId): readonly TeamId[] {
  return teams.includes(id) ? teams.filter((other) => other !== id) : normalizeTeams([...teams, id])
}

export function toggleLeague(teams: readonly TeamId[], league: League): readonly TeamId[] {
  const ids = ROSTERS[league].map((team) => team.id)
  return leagueSelection(teams, league) === 'all'
    ? teams.filter((id) => !ids.includes(id))
    : normalizeTeams([...teams, ...ids])
}

function gameMatcher(teams: readonly TeamId[], q: string): (game: Game) => boolean {
  const needle = q.trim().toLowerCase()
  const picked = new Set(teams)
  return (game) =>
    (teams.length === 0 || picked.has(game.home.id) || picked.has(game.away.id)) &&
    [game.home.name, game.away.name].some((name) => name.toLowerCase().includes(needle))
}

const visibleGames = memoizeLast(
  (
    games: ReadonlyMap<GameId, Game>,
    gameIds: readonly GameId[],
    teams: readonly TeamId[],
    q: string,
    sort: GameSort,
  ): readonly Game[] => {
    const visible = gameIds.map((id) => lookup(games, id)).filter(gameMatcher(teams, q))
    const compare = GAME_SORTS[sort]
    return compare === null ? visible : visible.toSorted(compare)
  },
)

export function selectVisibleGames(feed: Feed, query: FeedQuery): readonly Game[] {
  return visibleGames(feed.games, feed.gameIds, query.teams, query.q, query.sort)
}

function eventMatcher(
  games: ReadonlyMap<GameId, Game>,
  teams: readonly TeamId[],
  severity: Severity,
  q: string,
): (event: GameEvent) => boolean {
  const matches = gameMatcher(teams, q)
  const visible = new Set([...games.values()].filter(matches).map((game) => game.id))
  return (event) =>
    SEVERITY_RANK[event.severity] >= SEVERITY_RANK[severity] && visible.has(event.gameId)
}

const feedRows = memoizeLast(
  (
    games: ReadonlyMap<GameId, Game>,
    events: ReadonlyMap<EventId, GameEvent>,
    order: Ring<EventId>,
    gaps: readonly Gap[],
    teams: readonly TeamId[],
    severity: Severity,
    q: string,
    group: EventGrouping,
    since: number | null,
  ): readonly FeedRow[] => {
    const passes = eventMatcher(games, teams, severity, q)
    const groupOf = GROUPINGS[group]
    const newestGaps = gaps.toReversed()
    const sections = new Map<string, Section>()
    const emitGapsAbove = (section: Section, index: number) => {
      while (section.pending < newestGaps.length && newestGaps[section.pending].at > index) {
        const gap = newestGaps[section.pending]
        section.rows.push({ kind: 'gap', key: `gap:${section.key}:${gap.at}`, gap })
        section.pending++
      }
    }
    for (let age = 0; age < size(order); age++) {
      const event = lookup(events, at(order, age))
      if (!passes(event)) continue
      const game = lookup(games, event.gameId)
      const { key, label } = groupOf(game)
      let section = sections.get(key)
      if (section === undefined) {
        const rows: FeedRow[] =
          label === null ? [] : [{ kind: 'group', key: `group:${key}`, label }]
        section = { key, rows, pending: 0, fresh: 0, marked: false }
        sections.set(key, section)
      }
      const seq = order.written - 1 - age
      emitGapsAbove(section, seq)
      if (seq >= (since ?? Infinity)) section.fresh++
      else if (!section.marked) {
        section.marked = true
        if (section.fresh > 0)
          section.rows.push({ kind: 'since', key: `since:${section.key}`, count: section.fresh })
      }
      section.rows.push({ kind: 'event', key: event.id, seq, event, game })
    }
    for (const section of sections.values()) emitGapsAbove(section, -1)
    return [...sections.values()].flatMap((section) => section.rows)
  },
)

export function selectFeedRows(
  feed: Feed,
  query: FeedQuery,
  since: number | null,
): readonly FeedRow[] {
  return feedRows(
    feed.games,
    feed.events,
    feed.order,
    feed.gaps,
    query.teams,
    query.severity,
    query.q,
    query.group,
    since,
  )
}

export function parseSelection(raw: {
  readonly event?: string
  readonly game?: string
}): Selection | undefined {
  const event = raw.event === undefined ? undefined : parseEventId(raw.event)
  if (event !== undefined) return { kind: 'event', id: event }
  const game = raw.game === undefined ? undefined : parseGameId(raw.game)
  return game === undefined ? undefined : { kind: 'game', id: game }
}

export function selectionSearch(selection: Selection | undefined): SelectionSearch {
  return {
    event: selection?.kind === 'event' ? selection.id : undefined,
    game: selection?.kind === 'game' ? selection.id : undefined,
  }
}

function gameEventsNewestFirst(
  events: ReadonlyMap<EventId, GameEvent>,
  order: Ring<EventId>,
  id: GameId,
): GameEvent[] {
  const newestFirst: GameEvent[] = []
  for (let age = 0; age < size(order); age++) {
    const event = lookup(events, at(order, age))
    if (event.gameId === id) newestFirst.push(event)
  }
  return newestFirst
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
    const newestFirst = gameEventsNewestFirst(events, order, event.gameId)
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

const gameDetail = memoizeLast(
  (
    events: ReadonlyMap<EventId, GameEvent>,
    order: Ring<EventId>,
    games: ReadonlyMap<GameId, Game>,
    id: GameId,
  ): GameDetail => {
    const game = games.get(id)
    if (game === undefined) return MISSING
    const recent = gameEventsNewestFirst(events, order, id)
    return { kind: 'found', game, timeline: recent.toReversed(), recent }
  },
)

export function selectGameDetail(feed: Feed, id: GameId): GameDetail {
  return gameDetail(feed.events, feed.order, feed.games, id)
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
    teams: readonly TeamId[],
    severity: Severity,
    q: string,
  ): number => {
    const passes = eventMatcher(feed.games, teams, severity, q)
    const fresh = Math.min(feed.order.written - snapshotWritten, size(feed.order))
    let count = 0
    for (let age = 0; age < fresh; age++) {
      if (passes(eventAt(feed, age))) count++
    }
    return count
  },
)

export function countNewEvents(live: Feed, snapshot: Feed, query: FeedQuery): number {
  return newEventCount(live, snapshot.order.written, query.teams, query.severity, query.q)
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

export function selectFeedView(feed: Feed, query: FeedQuery, since: number | null): FeedView {
  if (feed.syncedAt === null) return LOADING
  if (size(feed.order) === 0) return EMPTY
  const rows = selectFeedRows(feed, query, since)
  return rows.length === 0 ? NO_MATCHES : rowsView(rows)
}

export function selectHeldView(snapshot: Feed, query: FeedQuery, since: number | null): FeedView {
  const view = selectFeedView(snapshot, query, since)
  return view === LOADING ? EMPTY : view
}

export function clearFilters(query: FeedQuery): FeedQuery {
  const { teams, severity, q } = DEFAULT_QUERY
  return { ...query, teams, severity, q }
}
