import { describe, expect, it } from 'vitest'
import type { GameEvent } from '#/domain/event'
import type { Game } from '#/domain/game'
import { eventId, gameId, type EventId, type TeamId } from '#/domain/ids'
import { ROSTERS } from '#/domain/roster'
import { createFeed, ingest, receive, type Feed } from './feed'
import { feedEvents, gamesOf, ingestTicks, simulate, simulatedFeed, TICK_MS } from './fixtures'
import { size } from './ring'
import {
  clearFilters,
  countNewEvents,
  DEFAULT_QUERY,
  leagueSelection,
  parseFeedQuery,
  parseSelection,
  selectEventDetail,
  selectGameDetail,
  selectFeedRows,
  selectFeedView,
  selectHeldView,
  selectVisibleGames,
  stepSelection,
  toggleLeague,
  toggleTeam,
  type FeedQuery,
  type FeedRow,
  type RelatedScope,
} from './view'

const { feed, events: emitted } = simulatedFeed(7, 120, 20_000)

const STATUS_ORDER = { live: 0, scheduled: 1, final: 2 }

function margin(game: Game): number {
  return Math.abs(game.score.home - game.score.away)
}

const NBA = ROSTERS.NBA.map((team) => team.id)

function query(overrides: Partial<FeedQuery>): FeedQuery {
  return { ...DEFAULT_QUERY, ...overrides }
}

function eventsOf(rows: readonly FeedRow[]): GameEvent[] {
  return rows.flatMap((row) => (row.kind === 'event' ? [row.event] : []))
}

function sections(rows: readonly FeedRow[]): { label: string; events: GameEvent[] }[] {
  const result: { label: string; events: GameEvent[] }[] = []
  for (const row of rows) {
    if (row.kind === 'group') result.push({ label: row.label, events: [] })
    else if (row.kind === 'event') result[result.length - 1].events.push(row.event)
  }
  return result
}

describe('selectVisibleGames', () => {
  it('shows every game in schedule order when no team is picked', () => {
    expect(selectVisibleGames(feed, DEFAULT_QUERY)).toEqual(gamesOf(feed))
  })

  it("keeps exactly the picked team's games, home or away", () => {
    const team = gamesOf(feed)[0].away
    const games = selectVisibleGames(feed, query({ teams: [team.id] }))
    expect(games.length).toBeGreaterThan(0)
    expect(games.length).toBeLessThan(gamesOf(feed).length)
    expect(games).toEqual(
      gamesOf(feed).filter((game) => [game.home.name, game.away.name].includes(team.name)),
    )
  })

  it("keeps the league's games when a whole sport is picked", () => {
    const games = selectVisibleGames(feed, query({ teams: toggleLeague([], 'NHL') }))
    expect(games.length).toBeGreaterThan(0)
    expect(games).toEqual(gamesOf(feed).filter((game) => game.league === 'NHL'))
  })

  it('intersects the picked teams with the search', () => {
    const nba = query({ teams: NBA })
    expect(selectVisibleGames(feed, { ...nba, q: ROSTERS.NHL[0].name })).toEqual([])
    const name = ROSTERS.NBA[0].name
    expect(selectVisibleGames(feed, { ...nba, q: name })).toEqual(
      gamesOf(feed).filter((game) => [game.home.name, game.away.name].includes(name)),
    )
  })

  it('matches team names case-insensitively, ignoring surrounding whitespace', () => {
    const name = gamesOf(feed)[0].home.name
    const needle = name.slice(1, 5).toLowerCase()
    const games = selectVisibleGames(feed, query({ q: `  ${needle.toUpperCase()} ` }))
    expect(games).toContain(gamesOf(feed)[0])
    expect(games).toEqual(
      gamesOf(feed).filter((game) =>
        `${game.home.name}|${game.away.name}`.toLowerCase().includes(needle),
      ),
    )
  })

  it('sorts closest games by margin, then live before scheduled before final', () => {
    const games = selectVisibleGames(feed, query({ sort: 'closest' }))
    expect(new Set(games)).toEqual(new Set(gamesOf(feed)))
    expect(new Set(games.map(margin)).size).toBeGreaterThan(1)
    const position = new Map(feed.gameIds.map((id, index) => [id, index]))
    for (const [a, b] of games.slice(1).map((game, index) => [games[index], game] as const)) {
      const order = [
        margin(a) - margin(b),
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
        (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0),
      ]
      expect(order.find((difference) => difference !== 0)).toBeLessThan(0)
    }
  })
})

describe('selectFeedRows', () => {
  it('lists every event at or above the minimum severity, newest first, without headers', () => {
    const rows = selectFeedRows(feed, query({ severity: 'notable' }))
    const expected = feedEvents(feed).filter((event) => event.severity !== 'info')
    expect(expected.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.kind === 'event')).toBe(true)
    expect(eventsOf(rows)).toEqual(expected)
  })

  it('heads each game section, orders sections by newest event, and keeps events newest-first', () => {
    const age = new Map(feedEvents(feed).map((event, index) => [event.id, index]))
    const rows = selectFeedRows(feed, query({ group: 'game' }))
    expect(rows[0].kind).toBe('group')
    const groups = sections(rows)
    expect(groups.length).toBeGreaterThan(1)
    for (const group of groups) {
      const game = feed.games.get(group.events[0].gameId)
      expect(group.label).toBe(`${game?.away.name} @ ${game?.home.name}`)
      expect(new Set(group.events.map((event) => event.gameId)).size).toBe(1)
    }
    const ages = groups.map((group) => group.events.map((event) => age.get(event.id) ?? -1))
    for (const within of ages) expect(within).toEqual(within.toSorted((a, b) => a - b))
    const heads = ages.map((within) => within[0])
    expect(heads).toEqual(heads.toSorted((a, b) => a - b))
    expect(ages.flat().toSorted((a, b) => a - b)).toEqual(
      Array.from({ length: size(feed.order) }, (_, i) => i),
    )
  })
})

function splitAtGroups(rows: readonly FeedRow[]): FeedRow[][] {
  const result: FeedRow[][] = []
  for (const row of rows) {
    if (row.kind === 'group') result.push([])
    else result[result.length - 1].push(row)
  }
  return result
}

function gapPosition(rows: readonly FeedRow[]): number {
  expect(rows.filter((row) => row.kind === 'gap')).toHaveLength(1)
  return rows.findIndex((row) => row.kind === 'gap')
}

describe('selectFeedRows with a gap', () => {
  const { initial, batches } = simulate(7, 200)
  const before = ingestTicks(createFeed(initial), batches.slice(0, 60))
  const slate = simulate(7, 70).final.games.map(({ game }) => game)
  const resynced = receive(
    before,
    [
      {
        kind: 'resynced',
        games: slate,
        since: 60_000,
        missed: batches.slice(60, 70).flat().length,
      },
    ],
    70_000,
  )
  const later = batches.slice(70)
  const gapped = receive(
    resynced,
    later.map((events) => ({ kind: 'events', events })),
    200_000,
  )
  const arrivedAfter = new Set(later.flat().map((event) => event.id))

  function newerCount(rows: readonly FeedRow[]): number {
    return eventsOf(rows).filter((event) => arrivedAfter.has(event.id)).length
  }

  it('places the gap between the events that arrived after the resync and those before it', () => {
    const rows = selectFeedRows(gapped, DEFAULT_QUERY)
    expect(eventsOf(rows)).toEqual(feedEvents(gapped))
    expect(newerCount(rows)).toBeGreaterThan(0)
    expect(gapPosition(rows)).toBe(newerCount(rows))
    expect(rows[gapPosition(rows)]).toEqual({
      kind: 'gap',
      key: `gap:all:${before.order.written}`,
      gap: gapped.gaps[0],
    })
  })

  it('repeats the gap inside each game section at that section’s own boundary', () => {
    const rows = selectFeedRows(gapped, query({ group: 'game' }))
    const groups = splitAtGroups(rows)
    expect(groups.some((group) => newerCount(group) === 0)).toBe(true)
    expect(groups.some((group) => newerCount(group) === eventsOf(group).length)).toBe(true)
    for (const group of groups) expect(gapPosition(group)).toBe(newerCount(group))
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length)
  })

  it('steps selection across the gap row as if it were not there', () => {
    const rows = selectFeedRows(gapped, DEFAULT_QUERY)
    const ids = eventsOf(rows).map((event) => event.id)
    const boundary = gapPosition(rows)
    expect(stepSelection(rows, ids[boundary - 1], 1)).toEqual({
      id: ids[boundary],
      index: boundary + 1,
    })
    expect(stepSelection(rows, ids[boundary], -1)).toEqual({
      id: ids[boundary - 1],
      index: boundary - 1,
    })
  })

  it('still reports no matches when the filters exclude every event', () => {
    expect(selectFeedView(gapped, query({ q: 'no team is called this' })).kind).toBe('no-matches')
  })
})

describe('countNewEvents', () => {
  const { initial, batches } = simulate(7, 120)
  const split = 30
  const snapshot = ingestTicks(createFeed(initial), batches.slice(0, split))
  const live = ingestTicks(snapshot, batches.slice(split))

  function newVisibleIds(q: FeedQuery): EventId[] {
    return eventsOf(selectFeedRows(live, q))
      .filter((event) => !snapshot.events.has(event.id))
      .map((event) => event.id)
  }

  it('counts only events ingested after the snapshot', () => {
    const fresh = newVisibleIds(DEFAULT_QUERY)
    expect(fresh.length).toBeGreaterThan(0)
    expect(fresh.length).toBeLessThan(size(live.order))
    expect(countNewEvents(live, snapshot, DEFAULT_QUERY)).toBe(fresh.length)
    expect(countNewEvents(live, live, DEFAULT_QUERY)).toBe(0)
  })

  it.each([
    ['severity', query({ severity: 'notable' })],
    ['team', query({ teams: NBA })],
  ])('respects the %s filter', (_, filtered) => {
    const fresh = newVisibleIds(filtered)
    expect(fresh.length).toBeGreaterThan(0)
    expect(fresh.length).toBeLessThan(newVisibleIds(DEFAULT_QUERY).length)
    expect(countNewEvents(live, snapshot, filtered)).toBe(fresh.length)
  })

  it('caps at the ring capacity when more new events were written than it holds', () => {
    const capacity = 5
    const small = ingestTicks(createFeed(initial, capacity), batches.slice(0, split))
    const overflowed = ingestTicks(small, batches.slice(split))
    expect(overflowed.order.written - small.order.written).toBeGreaterThan(capacity)
    expect(countNewEvents(overflowed, small, DEFAULT_QUERY)).toBe(capacity)
  })
})

describe('memoization', () => {
  const { initial, batches } = simulate(7, 120)
  const latest = batches.findLastIndex((batch) => batch.length > 0)
  const before = ingestTicks(createFeed(initial), batches.slice(0, latest))
  const after = ingest(before, batches[latest], latest * TICK_MS)

  it.each([
    ['selectVisibleGames', (target: Feed, q: FeedQuery) => selectVisibleGames(target, q)],
    ['selectFeedRows', (target: Feed, q: FeedQuery) => selectFeedRows(target, q)],
  ])('%s returns the cached result until the feed or a query field changes', (_, select) => {
    const base = query({ teams: NBA })
    const first = select(before, base)
    expect(select(before, { ...base, teams: [...NBA] })).toBe(first)
    const ingested = select(after, base)
    expect(ingested).not.toBe(first)
    expect(select(after, query({ teams: NBA.slice(1) }))).not.toBe(ingested)
  })
})

describe('selectFeedView', () => {
  const { initial } = simulate(7, 1)

  it('is loading until the first sync', () => {
    expect(selectFeedView(createFeed(initial), DEFAULT_QUERY).kind).toBe('loading')
  })

  it('shows a snapshot held before the first sync as empty rather than loading', () => {
    expect(selectHeldView(createFeed(initial), DEFAULT_QUERY).kind).toBe('empty')
  })

  it('shows a synced held snapshot the same as the live view', () => {
    expect(selectHeldView(feed, DEFAULT_QUERY)).toBe(selectFeedView(feed, DEFAULT_QUERY))
  })

  it('is empty once synced with no events in the ring', () => {
    const synced = ingest(createFeed(initial), [], 0)
    expect(selectFeedView(synced, DEFAULT_QUERY).kind).toBe('empty')
  })

  it('reports no matches when events exist but the filters exclude all of them', () => {
    expect(size(feed.order)).toBeGreaterThan(0)
    expect(selectFeedView(feed, query({ q: 'no team is called this' })).kind).toBe('no-matches')
  })

  it('lists the matching rows newest first', () => {
    const view = selectFeedView(feed, DEFAULT_QUERY)
    expect(view.kind === 'rows' && eventsOf(view.rows)).toEqual(feedEvents(feed))
  })

  it('returns the same view across repeated calls and heartbeats', () => {
    const first = selectFeedView(feed, query({ teams: NBA }))
    expect(first.kind).toBe('rows')
    expect(selectFeedView(feed, query({ teams: [...NBA] }))).toBe(first)
    expect(selectFeedView(ingest(feed, [], Date.now()), query({ teams: NBA }))).toBe(first)
  })
})

describe('clearFilters', () => {
  it('resets teams, severity, and search but keeps sort and grouping', () => {
    const cleared = clearFilters({
      teams: NBA,
      severity: 'critical',
      q: 'hawks',
      sort: 'closest',
      group: 'game',
    })
    expect(cleared).toEqual({ ...DEFAULT_QUERY, sort: 'closest', group: 'game' })
  })
})

describe('parseFeedQuery', () => {
  it('keeps valid fields and falls back per field for the rest', () => {
    expect(
      parseFeedQuery({ teams: [NBA[0]], severity: 'loud', q: 'hawks', sort: 'closest' }),
    ).toEqual({ teams: [NBA[0]], severity: 'info', q: 'hawks', sort: 'closest', group: 'none' })
  })

  it('keeps only known team ids, deduped in roster order', () => {
    const nhl = ROSTERS.NHL[0].id
    expect(parseFeedQuery({ teams: [nhl, 'nba-nobody', NBA[2], 7, NBA[0], nhl] }).teams).toEqual([
      NBA[0],
      NBA[2],
      nhl,
    ])
  })

  it.each([['nba-harbor-hawks'], [{ 0: NBA[0] }], [null], [undefined]])(
    'falls back to no teams for %j',
    (teams) => {
      expect(parseFeedQuery({ teams }).teams).toEqual([])
    },
  )
})

describe('team selection', () => {
  it('reports a sport as all, some, or none of its teams picked', () => {
    expect(leagueSelection([], 'NBA')).toBe('none')
    expect(leagueSelection([NBA[1]], 'NBA')).toBe('some')
    expect(leagueSelection(NBA, 'NBA')).toBe('all')
    expect(leagueSelection(NBA, 'NFL')).toBe('none')
  })

  it('completes a partly picked sport, then clears it without touching other teams', () => {
    const nfl: TeamId = ROSTERS.NFL[1].id
    const partial = [NBA[3], nfl]
    const full = toggleLeague(partial, 'NBA')
    expect(full).toEqual([...NBA, nfl])
    expect(toggleLeague(full, 'NBA')).toEqual([nfl])
  })

  it('adds a team in roster order and removes it on the second toggle', () => {
    const added = toggleTeam([NBA[3]], NBA[1])
    expect(added).toEqual([NBA[1], NBA[3]])
    expect(toggleTeam(added, NBA[3])).toEqual([NBA[1]])
  })
})

describe('selectEventDetail', () => {
  const selected = emitted.find((event) => {
    const peers = emitted.filter((other) => other.gameId === event.gameId)
    const drive = peers.filter((other) => other.drive === event.drive)
    return drive.length > 2 && peers.length > drive.length
  })
  if (selected === undefined) throw new Error('fixture has no multi-event drive')

  const found = (scope: RelatedScope) => {
    const detail = selectEventDetail(feed, selected.id, scope)
    if (detail.kind !== 'found') throw new Error('expected the selected event to be found')
    return detail
  }

  it('returns the event, its game, and the full chronological timeline of that game', () => {
    const detail = found('game')
    expect(detail.event).toBe(selected)
    expect(detail.game).toBe(feed.games.get(selected.gameId))
    expect(detail.timeline).toEqual(emitted.filter((event) => event.gameId === selected.gameId))
    const stamps = detail.timeline.map((event) => event.ts)
    expect(stamps).toEqual(stamps.toSorted((a, b) => a - b))
  })

  it('lists the rest of the game newest first for the game scope', () => {
    const detail = found('game')
    expect(detail.related).toEqual(
      detail.timeline.toReversed().filter((event) => event.id !== selected.id),
    )
  })

  it('spans the selected drive from its first to its last event', () => {
    const stamps = emitted
      .filter((event) => event.gameId === selected.gameId && event.drive === selected.drive)
      .map((event) => event.ts)
    expect(found('game').driveSpan).toEqual({ start: stamps[0], end: stamps.at(-1) })
  })

  it('narrows the drive scope to a strict subset sharing the game and drive', () => {
    const drive = found('drive').related
    const game = found('game').related
    expect(drive.length).toBeGreaterThan(0)
    expect(drive.length).toBeLessThan(game.length)
    for (const event of drive) {
      expect(event.gameId).toBe(selected.gameId)
      expect(event.drive).toBe(selected.drive)
    }
    expect(game.filter((event) => drive.includes(event))).toEqual(drive)
    expect(drive).not.toContain(selected)
  })

  it('reports missing for an unknown id and for an evicted event', () => {
    expect(selectEventDetail(feed, eventId(999_999), 'game')).toEqual({ kind: 'missing' })
    const small = simulatedFeed(7, 120, 50)
    expect(selectEventDetail(small.feed, small.events[0].id, 'game')).toEqual({ kind: 'missing' })
  })

  it('returns the cached detail until an input changes', () => {
    const first = selectEventDetail(feed, selected.id, 'drive')
    expect(selectEventDetail(feed, selected.id, 'drive')).toBe(first)
    expect(selectEventDetail(feed, selected.id, 'game')).not.toBe(first)
  })
})

describe('selectGameDetail', () => {
  const selected = emitted[emitted.length >> 1].gameId
  const ofGame = emitted.filter((event) => event.gameId === selected)

  const found = (target: Feed) => {
    const detail = selectGameDetail(target, selected)
    if (detail.kind !== 'found') throw new Error('expected the selected game to be found')
    return detail
  }

  it('returns the game with exactly its events oldest first on the timeline', () => {
    const detail = found(feed)
    expect(ofGame.length).toBeGreaterThan(1)
    expect(detail.game).toBe(feed.games.get(selected))
    expect(detail.timeline).toEqual(ofGame)
  })

  it('lists recent events newest first', () => {
    expect(found(feed).recent).toEqual(ofGame.toReversed())
  })

  it('reports missing for an unknown id and for a game evicted from the feed', () => {
    expect(selectGameDetail(feed, gameId('nba-999999'))).toEqual({ kind: 'missing' })
    const small = simulatedFeed(7, 400, 50)
    const evicted = small.events.find((event) => !small.feed.games.has(event.gameId))
    if (evicted === undefined) throw new Error('fixture evicted no game')
    expect(selectGameDetail(small.feed, evicted.gameId)).toEqual({ kind: 'missing' })
  })

  it('returns the cached detail across heartbeats until the ring changes', () => {
    const first = found(feed)
    expect(found(ingest(feed, [], Date.now()))).toBe(first)
    const later = ingestTicks(feed, simulate(7, 140).batches.slice(120))
    expect(size(later.order)).toBeGreaterThan(size(feed.order))
    expect(selectGameDetail(later, selected)).not.toBe(first)
  })
})

describe('parseSelection', () => {
  const event = eventId(12)
  const game = gameId('nba-3')

  it('parses a single event or game selection', () => {
    expect(parseSelection({ event })).toEqual({ kind: 'event', id: event })
    expect(parseSelection({ game })).toEqual({ kind: 'game', id: game })
  })

  it('prefers the event when both arrive', () => {
    expect(parseSelection({ event, game })).toEqual({ kind: 'event', id: event })
  })

  it('ignores malformed and missing ids', () => {
    expect(parseSelection({})).toBeUndefined()
    expect(parseSelection({ event: 'nope', game: 'Not A Slug' })).toBeUndefined()
    expect(parseSelection({ event: '42', game: 'nba-3' })).toEqual({ kind: 'game', id: game })
  })
})

describe('stepSelection', () => {
  const rows = selectFeedRows(feed, query({ group: 'game' }))
  const ids = eventsOf(rows).map((event) => event.id)
  const headers = rows.filter((row) => row.kind === 'group').map((row) => row.key)

  it('starts at the first event row in either direction when nothing is selected', () => {
    expect(rows[0].kind).toBe('group')
    expect(stepSelection(rows, undefined, 1)).toEqual({ id: ids[0], index: 1 })
    expect(stepSelection(rows, undefined, -1)?.id).toBe(ids[0])
    expect(stepSelection(rows, eventId(999_999), -1)?.id).toBe(ids[0])
  })

  it('walks every event row in order, skipping group headers', () => {
    const visited = [ids[0]]
    for (let i = 1; i < ids.length; i++) {
      const step = stepSelection(rows, visited[i - 1], 1)
      expect(step === null ? null : rows[step.index].key).toBe(step?.id)
      visited.push(step?.id ?? ids[0])
    }
    expect(visited).toEqual(ids)
    expect(headers.length).toBeGreaterThan(1)
  })

  it('clamps at both ends instead of wrapping', () => {
    expect(stepSelection(rows, ids[0], -1)?.id).toBe(ids[0])
    expect(stepSelection(rows, ids.at(-1), 1)?.id).toBe(ids.at(-1))
  })

  it('selects nothing when there are no event rows', () => {
    expect(stepSelection([], undefined, 1)).toBeNull()
    expect(stepSelection([{ kind: 'group', key: 'group:x', label: 'X' }], ids[0], -1)).toBeNull()
  })
})
