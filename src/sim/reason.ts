import type { EventDraft, Reason } from '#/domain/event'
import { leaderOf, type Game } from '#/domain/game'
import type { LeagueRules } from './leagues'

export function reasonFor(draft: EventDraft, before: Game, rules: LeagueRules): Reason {
  const late = before.status === 'live' && before.period >= rules.periods
  switch (draft.kind) {
    case 'score': {
      const goAhead =
        leaderOf(before, draft.score) === draft.teamId &&
        leaderOf(before, before.score) !== draft.teamId
      if (!goAhead) return 'routine'
      return late ? 'late_go_ahead' : 'go_ahead'
    }
    case 'lead_change':
      return late ? 'late_lead_change' : 'lead_change'
    case 'odds_shift':
      return Math.abs(draft.to - draft.from) >= rules.markets[draft.market].notableShift
        ? 'line_move'
        : 'routine'
    case 'injury':
      return 'injury'
    case 'game_ended':
      return 'final'
    case 'game_started':
    case 'period_ended':
    case 'game_scheduled':
      return 'routine'
  }
}
