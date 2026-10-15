import { describe, expect, it } from 'vitest'
import type { TeamId } from '#/domain/ids'
import { ROSTERS } from '#/domain/roster'
import {
  clearFilters,
  DEFAULT_QUERY,
  leagueSelection,
  parseFeedQuery,
  toggleLeague,
  toggleTeam,
} from './query'

const NBA = ROSTERS.NBA.map((team) => team.id)

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
