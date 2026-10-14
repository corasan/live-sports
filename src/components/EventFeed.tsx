import type { GameEvent, Market, Severity } from '#/domain/event'
import type { Game } from '#/domain/game'
import type { GameId, TeamId } from '#/domain/ids'
import { PERIOD_PREFIX } from './Scoreboard'

const SEVERITY_STYLE: Readonly<Record<Severity, string>> = {
  info: 'border-slate-200 text-slate-600',
  notable: 'border-amber-400 bg-amber-50 text-slate-900',
  critical: 'border-red-500 bg-red-50 font-semibold text-red-900',
}

const MARKET_LABEL: Readonly<Record<Market, string>> = {
  moneyline: 'Home win %',
  spread: 'Spread',
  total: 'Total',
}

function teamName(game: Game, id: TeamId): string {
  return id === game.home.id ? game.home.name : game.away.name
}

function describeEvent(event: GameEvent, game: Game): string {
  switch (event.kind) {
    case 'game_started':
      return 'Game started'
    case 'score':
      return `${teamName(game, event.teamId)} +${event.points} (${event.score.away}-${event.score.home})`
    case 'lead_change':
      return `${teamName(game, event.leader)} take the lead`
    case 'period_ended':
      return `End of ${PERIOD_PREFIX[game.league]}${event.period}`
    case 'injury':
      return `${event.player} (${teamName(game, event.teamId)}) injured`
    case 'odds_shift':
      return `${MARKET_LABEL[event.market]} ${event.from} → ${event.to}`
    case 'game_ended':
      return `Final ${event.score.away}-${event.score.home}`
  }
}

export function EventFeed({
  events,
  games,
}: {
  events: readonly GameEvent[]
  games: readonly Game[]
}) {
  const gamesById = new Map<GameId, Game>(games.map((game) => [game.id, game]))
  return (
    <ol className="flex flex-col gap-2">
      {events.map((event) => {
        const game = gamesById.get(event.gameId)
        if (game === undefined) return null
        return (
          <li
            key={event.id}
            className={`flex gap-3 rounded border-l-4 px-3 py-2 text-sm ${SEVERITY_STYLE[event.severity]}`}
          >
            <time className="text-xs text-slate-400 tabular-nums">
              {new Date(event.ts).toLocaleTimeString()}
            </time>
            <span className="text-xs text-slate-500">
              {game.away.name} @ {game.home.name}
            </span>
            <span>{describeEvent(event, game)}</span>
          </li>
        )
      })}
    </ol>
  )
}
