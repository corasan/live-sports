import type { Game, GameStatus } from './game'
import type { EventId, GameId, TeamId } from './ids'

export type Severity = 'info' | 'notable' | 'critical'

export type Score = { readonly home: number; readonly away: number }

export type Market = 'moneyline' | 'spread' | 'total'

export type Reason =
  | 'routine'
  | 'go_ahead'
  | 'late_go_ahead'
  | 'lead_change'
  | 'late_lead_change'
  | 'line_move'
  | 'injury'
  | 'final'

export const REASON_SEVERITY: Readonly<Record<Reason, Severity>> = {
  routine: 'info',
  go_ahead: 'notable',
  late_go_ahead: 'critical',
  lead_change: 'notable',
  late_lead_change: 'critical',
  line_move: 'notable',
  injury: 'notable',
  final: 'notable',
}

export type Moment = GameStatus & { readonly score: Score }

type EventBase = {
  readonly id: EventId
  readonly ts: number
  readonly gameId: GameId
  readonly reason: Reason
  readonly before: Moment
}

export type GameEvent = EventBase &
  (
    | { readonly kind: 'game_started' }
    | {
        readonly kind: 'score'
        readonly teamId: TeamId
        readonly points: number
        readonly score: Score
      }
    | { readonly kind: 'lead_change'; readonly leader: TeamId }
    | { readonly kind: 'period_ended'; readonly period: number }
    | { readonly kind: 'injury'; readonly teamId: TeamId; readonly player: string }
    | {
        readonly kind: 'odds_shift'
        readonly market: Market
        readonly from: number
        readonly to: number
      }
    | { readonly kind: 'game_ended'; readonly score: Score }
    | { readonly kind: 'game_scheduled'; readonly game: Game; readonly replaces: GameId }
  )

export type EventKind = GameEvent['kind']

export type EventOf<K extends EventKind> = Extract<GameEvent, { kind: K }>

type Draft<E extends GameEvent> = E extends GameEvent ? Omit<E, keyof EventBase> : never

export type EventDraft = Draft<GameEvent>

export function severityOf(event: GameEvent): Severity {
  return REASON_SEVERITY[event.reason]
}
