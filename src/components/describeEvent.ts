import type { GameEvent, Market, Severity } from '#/domain/event'
import { PERIOD_PREFIX, type Game } from '#/domain/game'
import type { TeamId } from '#/domain/ids'

export type Matchup = Pick<Game, 'league' | 'home' | 'away'>

export const SEVERITY_STYLE: Readonly<Record<Severity, string>> = {
  info: 'border-slate-200 text-slate-600',
  notable: 'border-amber-400 bg-amber-50 text-slate-900',
  critical: 'border-red-500 bg-red-50 font-semibold text-red-900',
}

export const SEVERITY_DOT: Readonly<Record<Severity, string>> = {
  info: 'bg-slate-400',
  notable: 'bg-amber-400',
  critical: 'bg-red-500',
}

const MARKET_LABEL: Readonly<Record<Market, string>> = {
  moneyline: 'Home win %',
  spread: 'Spread',
  total: 'Total',
}

function teamName(matchup: Matchup, id: TeamId): string {
  return id === matchup.home.id ? matchup.home.name : matchup.away.name
}

export function eventTime(event: GameEvent): string {
  return new Date(event.ts).toLocaleTimeString()
}

export function describeEvent(event: GameEvent, matchup: Matchup): string {
  switch (event.kind) {
    case 'game_started':
      return 'Game started'
    case 'score':
      return `${teamName(matchup, event.teamId)} +${event.points} (${event.score.away}-${event.score.home})`
    case 'lead_change':
      return `${teamName(matchup, event.leader)} take the lead`
    case 'period_ended':
      return `End of ${PERIOD_PREFIX[matchup.league]}${event.period}`
    case 'injury':
      return `${event.player} (${teamName(matchup, event.teamId)}) injured`
    case 'odds_shift':
      return `${MARKET_LABEL[event.market]} ${event.from} → ${event.to}`
    case 'game_ended':
      return `Final ${event.score.away}-${event.score.home}`
  }
}
