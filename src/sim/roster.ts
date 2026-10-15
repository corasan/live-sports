import { LEAGUES, type League, type Team } from '#/domain/game'
import { teamId } from '#/domain/ids'
import { LEAGUE_RULES } from './leagues'

export const ROSTERS: Readonly<Record<League, readonly Team[]>> = {
  NBA: rosterOf('NBA'),
  NFL: rosterOf('NFL'),
  NHL: rosterOf('NHL'),
}

export const ROSTER: readonly Team[] = LEAGUES.flatMap((league) => ROSTERS[league])

function rosterOf(league: League): readonly Team[] {
  return LEAGUE_RULES[league].teams.map((name) => ({
    id: teamId(`${league}-${name}`.toLowerCase().replaceAll(/[^a-z0-9]+/gu, '-')),
    name,
  }))
}
