import type { Severity } from '#/domain/event'
import type { League, Team } from '#/domain/game'
import type { TeamId } from '#/domain/ids'
import { ROSTER, ROSTERS } from '#/domain/roster'

export const SEVERITIES = ['info', 'notable', 'critical'] as const satisfies readonly Severity[]
export const GAME_SORT_OPTIONS = ['schedule', 'closest', 'league'] as const
export const EVENT_GROUPINGS = ['none', 'game', 'league'] as const

export type GameSort = (typeof GAME_SORT_OPTIONS)[number]
export type EventGrouping = (typeof EVENT_GROUPINGS)[number]

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

export function clearFilters(query: FeedQuery): FeedQuery {
  const { teams, severity, q } = DEFAULT_QUERY
  return { ...query, teams, severity, q }
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
