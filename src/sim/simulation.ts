import type { EventDraft, EventKind, GameEvent, Market } from '#/domain/event'
import { applyEvent, leaderOf, LEAGUES, type Game, type League, type Odds } from '#/domain/game'
import { eventId, gameId, type GameId, type TeamId } from '#/domain/ids'
import { LEAGUE_RULES, type LeagueRules, type MarketRules, type PlayKind } from './leagues'
import { createRng, type Rng } from './rng'
import { ROSTERS } from '#/domain/roster'
import { severityOf } from './severity'

export type SimGame = {
  readonly game: Game
  readonly startsAtTick: number
  readonly elapsed: number
  readonly lastLeader: TeamId | null
  readonly drive: number
}

export type SimState = {
  readonly tick: number
  readonly nextSequence: number
  readonly nextGame: number
  readonly rngState: number
  readonly games: readonly SimGame[]
}

export type StepResult = { readonly state: SimState; readonly events: readonly GameEvent[] }

type Progress = { readonly drafts: readonly EventDraft[]; readonly elapsed: number }

type Play = (entry: SimGame, rules: LeagueRules, rng: Rng) => readonly EventDraft[]

const MARKETS = ['moneyline', 'spread', 'total'] as const satisfies readonly Market[]

const CLOSES_DRIVE: Readonly<Record<EventKind, boolean>> = {
  game_started: false,
  score: true,
  lead_change: false,
  period_ended: true,
  injury: false,
  odds_shift: false,
  game_ended: false,
  game_scheduled: false,
}

const PLAYERS = [
  'J. Okafor',
  'M. Reyes',
  'T. Lindqvist',
  'D. Mensah',
  'A. Novak',
  'K. Sato',
] as const

const PLAYS: Readonly<Record<PlayKind, Play>> = {
  score: ({ game, lastLeader }, rules, rng) => {
    const side = rng.pick(['home', 'away'] as const)
    const points = rng.weighted(rules.scoring)
    const score = { ...game.score, [side]: game.score[side] + points }
    const scoring = game[side].id
    const leader = leaderOf(game, score)
    const flipped = leader !== null && lastLeader !== null && leader !== lastLeader
    return [
      { kind: 'score', teamId: scoring, points, score },
      ...(flipped ? [{ kind: 'lead_change' as const, leader }] : []),
    ]
  },
  odds_shift: ({ game }, rules, rng) => {
    const market = rng.pick(MARKETS)
    const from = game.odds[market]
    const to = shiftLine(from, rules.markets[market], rng)
    return to === from ? [] : [{ kind: 'odds_shift', market, from, to }]
  },
  injury: ({ game }, _rules, rng) => [
    { kind: 'injury', teamId: rng.pick([game.home.id, game.away.id]), player: rng.pick(PLAYERS) },
  ],
  quiet: () => [],
}

export function createSimulation(seed: number): SimState {
  const rng = createRng(seed)
  let nextGame = 1
  const games = LEAGUES.flatMap((league) => {
    const seeded = seedLeague(league, nextGame, rng)
    nextGame += seeded.length
    return seeded
  })
  return { tick: 0, nextSequence: 0, nextGame, rngState: rng.state(), games }
}

export function step(state: SimState, now: number): StepResult {
  const rng = createRng(state.rngState)
  const tick = state.tick + 1
  let nextSequence = state.nextSequence
  let nextGame = state.nextGame
  const events: GameEvent[] = []

  const emit = (draft: EventDraft, game: Game, drive: number, rules: LeagueRules): GameEvent => {
    const event: GameEvent = {
      ...draft,
      id: eventId(nextSequence++),
      ts: now,
      gameId: game.id,
      drive,
      severity: severityOf(draft, game, rules),
    }
    events.push(event)
    return event
  }

  const games = state.games.map((entry): SimGame => {
    const rules = LEAGUE_RULES[entry.game.league]
    const { drafts, elapsed } = advance(entry, tick, rules, rng)
    let game = entry.game
    let drive = entry.drive
    for (const draft of drafts) {
      const event = emit(draft, game, drive, rules)
      game = applyEvent(game, event)
      if (CLOSES_DRIVE[event.kind]) drive++
    }
    if (game.status === 'final') {
      const next = rematch(game, numberedGameId(game.league, nextGame++), tick, rules, rng)
      emit({ kind: 'game_scheduled', game: next.game, replaces: game.id }, next.game, 0, rules)
      return next
    }
    return {
      ...entry,
      game,
      elapsed,
      drive,
      lastLeader: leaderOf(game, game.score) ?? entry.lastLeader,
    }
  })

  return { state: { tick, nextSequence, nextGame, rngState: rng.state(), games }, events }
}

function advance(entry: SimGame, tick: number, rules: LeagueRules, rng: Rng): Progress {
  const { game } = entry
  switch (game.status) {
    case 'scheduled':
      return {
        drafts: tick >= entry.startsAtTick ? [{ kind: 'game_started' }] : [],
        elapsed: 0,
      }
    case 'final':
      return { drafts: [], elapsed: entry.elapsed }
    case 'live': {
      const elapsed = entry.elapsed + 1
      if (elapsed < rules.ticksPerPeriod) {
        return { drafts: PLAYS[rng.weighted(rules.plays)](entry, rules, rng), elapsed }
      }
      return {
        drafts:
          game.period >= rules.periods
            ? [{ kind: 'game_ended', score: game.score }]
            : [{ kind: 'period_ended', period: game.period }],
        elapsed: 0,
      }
    }
  }
}

function seedLeague(league: League, firstGame: number, rng: Rng): SimGame[] {
  const rules = LEAGUE_RULES[league]
  const teams = rng.shuffle(ROSTERS[league])
  return Array.from({ length: rules.games }, (_, index) =>
    scheduled(
      {
        id: numberedGameId(league, firstGame + index),
        league,
        home: teams[index * 2],
        away: teams[index * 2 + 1],
        status: 'scheduled',
        score: { home: 0, away: 0 },
        odds: seedOdds(rules, rng),
      },
      index === 0 ? 1 : rng.int(2, 40),
    ),
  )
}

function rematch(finished: Game, id: GameId, tick: number, rules: LeagueRules, rng: Rng): SimGame {
  return scheduled(
    {
      id,
      league: finished.league,
      home: finished.away,
      away: finished.home,
      status: 'scheduled',
      score: { home: 0, away: 0 },
      odds: seedOdds(rules, rng),
    },
    tick + rng.int(2, 8),
  )
}

function scheduled(game: Game, startsAtTick: number): SimGame {
  return { game, startsAtTick, elapsed: 0, lastLeader: null, drive: 0 }
}

function numberedGameId(league: League, number: number): GameId {
  return gameId(`${league.toLowerCase()}-${number}`)
}

function seedOdds(rules: LeagueRules, rng: Rng): Odds {
  const line = ({ min, max, unit }: MarketRules) =>
    min + rng.int(0, Math.round((max - min) / unit)) * unit
  return {
    moneyline: line(rules.markets.moneyline),
    spread: line(rules.markets.spread),
    total: line(rules.markets.total),
  }
}

function shiftLine(from: number, market: MarketRules, rng: Rng): number {
  const delta = rng.int(1, market.maxUnits) * market.unit * rng.pick([1, -1])
  return Math.min(market.max, Math.max(market.min, from + delta))
}
