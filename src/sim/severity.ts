import type { EventDraft, Severity } from '#/domain/event'
import { leaderOf, type Game } from '#/domain/game'
import type { LeagueRules } from './leagues'

export function severityOf(draft: EventDraft, before: Game, rules: LeagueRules): Severity {
  const late = before.status === 'live' && before.period >= rules.periods
  switch (draft.kind) {
    case 'score': {
      const goAhead =
        leaderOf(before, draft.score) === draft.teamId &&
        leaderOf(before, before.score) !== draft.teamId
      if (!goAhead) return 'info'
      return late ? 'critical' : 'notable'
    }
    case 'lead_change':
      return late ? 'critical' : 'notable'
    case 'odds_shift':
      return Math.abs(draft.to - draft.from) >= rules.markets[draft.market].notableShift
        ? 'notable'
        : 'info'
    case 'injury':
    case 'game_ended':
      return 'notable'
    case 'game_started':
    case 'period_ended':
      return 'info'
  }
}
