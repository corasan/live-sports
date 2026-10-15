import type { GameEvent, Severity } from '#/domain/event'
import { matchupLabel, type Game, type GameStatus } from '#/domain/game'
import type { EventId, GameId, TeamId } from '#/domain/ids'
import { eventAt, lookup, type Feed, type Gap } from './feed'
import { memoizeLast } from './memo'
import type { EventGrouping, FeedQuery, GameSort } from './query'
import { at, size, type Ring } from './ring'
import type { Selection } from './selection'

type Missing = { readonly kind: 'missing' }

export type Detail =
  | Missing
  | {
      readonly kind: 'found'
      readonly game: Game
      readonly timeline: readonly GameEvent[]
      readonly recent: readonly GameEvent[]
      readonly focus: EventId | null
    }

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

export type Step = { readonly id: EventId; readonly index: number }

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

const detail = memoizeLast(
  (
    events: ReadonlyMap<EventId, GameEvent>,
    order: Ring<EventId>,
    games: ReadonlyMap<GameId, Game>,
    id: GameId,
    focus: EventId | null,
  ): Detail => {
    const game = games.get(id)
    if (game === undefined) return MISSING
    const recent = gameEventsNewestFirst(events, order, id)
    return { kind: 'found', game, timeline: recent.toReversed(), recent, focus }
  },
)

export function selectDetail(feed: Feed, selection: Selection): Detail {
  switch (selection.kind) {
    case 'game':
      return detail(feed.events, feed.order, feed.games, selection.id, null)
    case 'event': {
      const event = feed.events.get(selection.id)
      if (event === undefined) return MISSING
      return detail(feed.events, feed.order, feed.games, event.gameId, event.id)
    }
  }
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
