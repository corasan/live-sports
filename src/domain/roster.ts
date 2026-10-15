import { LEAGUES, type League, type Team } from './game'
import { teamId } from './ids'

const TEAM_NAMES: Readonly<Record<League, readonly string[]>> = {
  NBA: [
    'Harbor Hawks',
    'Mesa Comets',
    'Granite Bears',
    'Delta Herons',
    'Summit Owls',
    'Cobalt Kings',
  ],
  NFL: ['River Rams', 'Iron Foxes', 'Prairie Bison', 'Coastal Marlins'],
  NHL: [
    'Glacier Wolves',
    'Northern Lynx',
    'Copper Stags',
    'Lakeside Pike',
    'Timber Ravens',
    'Frost Giants',
  ],
}

function rosterOf(league: League): readonly Team[] {
  return TEAM_NAMES[league].map((name) => ({
    id: teamId(`${league}-${name}`.toLowerCase().replaceAll(/[^a-z0-9]+/gu, '-')),
    name,
  }))
}

export const ROSTERS: Readonly<Record<League, readonly Team[]>> = {
  NBA: rosterOf('NBA'),
  NFL: rosterOf('NFL'),
  NHL: rosterOf('NHL'),
}

export const ROSTER: readonly Team[] = LEAGUES.flatMap((league) => ROSTERS[league])
