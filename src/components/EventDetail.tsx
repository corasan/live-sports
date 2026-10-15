import { severityOf, type GameEvent, type Reason } from '#/domain/event'
import type { Game } from '#/domain/game'
import { describeEvent, eventTime, scoreLabel, SEVERITY_STYLE } from './describeEvent'
import { marketDelta, statusLabel } from './gameLabels'

type Fact = { readonly label: string; readonly value: string }

const REASON_TEXT: Readonly<Record<Reason, string>> = {
  routine: 'Routine play',
  go_ahead: 'This score put the team ahead',
  late_go_ahead: 'Go-ahead score in the final period',
  lead_change: 'The lead changed hands',
  late_lead_change: 'The lead changed hands in the final period',
  line_move: "The line moved past this market's notable threshold",
  injury: 'Injuries can swing a game and its odds',
  final: 'The game is over',
}

function kindFacts(event: GameEvent): readonly Fact[] {
  switch (event.kind) {
    case 'score':
      return [
        { label: 'Score', value: `${scoreLabel(event.before.score)} → ${scoreLabel(event.score)}` },
      ]
    case 'odds_shift':
      return [
        { label: 'Score', value: scoreLabel(event.before.score) },
        { label: 'Move', value: marketDelta(event.market, event.from, event.to) },
      ]
    case 'game_scheduled':
      return [{ label: 'Replaces', value: event.replaces }]
    default:
      return [{ label: 'Score', value: scoreLabel(event.before.score) }]
  }
}

export function EventDetail({ event, game }: { event: GameEvent; game: Game }) {
  const facts: readonly Fact[] = [
    { label: 'Time', value: eventTime(event) },
    { label: 'Game', value: statusLabel(game.league, event.before) },
    ...kindFacts(event),
    { label: 'Why', value: REASON_TEXT[event.reason] },
  ]
  return (
    <section aria-label="Selected event" className="flex flex-col gap-2">
      <p className={`rounded px-3 py-2 text-sm ${SEVERITY_STYLE[severityOf(event)]}`}>
        {describeEvent(event, game)}
      </p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        {facts.map(({ label, value }) => (
          <div key={label} className="contents">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-slate-800 tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
