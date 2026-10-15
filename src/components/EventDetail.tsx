import {
  severityOf,
  type EventKind,
  type EventOf,
  type GameEvent,
  type Reason,
  type Score,
} from '#/domain/event'
import type { Game } from '#/domain/game'
import { clockTime, describeEvent, SEVERITY_STYLE } from './describeEvent'
import { marketDelta, statusLabel } from './gameLabels'

type Fact = { readonly label: string; readonly value: string }

type KindFacts = { readonly [K in EventKind]: (event: EventOf<K>) => readonly Fact[] }

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

function scoreLabel(score: Score): string {
  return `${score.away}-${score.home}`
}

const scoreAtEvent = (event: GameEvent): readonly Fact[] => [
  { label: 'Score', value: scoreLabel(event.before.score) },
]

const KIND_FACTS: KindFacts = {
  game_started: scoreAtEvent,
  score: (event) => [
    { label: 'Score', value: `${scoreLabel(event.before.score)} → ${scoreLabel(event.score)}` },
  ],
  lead_change: scoreAtEvent,
  period_ended: scoreAtEvent,
  injury: scoreAtEvent,
  odds_shift: (event) => [
    ...scoreAtEvent(event),
    { label: 'Move', value: marketDelta(event.market, event.from, event.to) },
  ],
  game_ended: scoreAtEvent,
  game_scheduled: (event) => [{ label: 'Replaces', value: event.replaces }],
}

function kindFacts<K extends EventKind>(event: EventOf<K>): readonly Fact[] {
  const facts: (event: EventOf<K>) => readonly Fact[] = KIND_FACTS[event.kind]
  return facts(event)
}

export function EventDetail({ event, game }: { event: GameEvent; game: Game }) {
  const facts: readonly Fact[] = [
    { label: 'Time', value: clockTime(event.ts) },
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
