import type { EventDraft, GameEvent, Market } from '#/domain/event'
import { applyEvent, leaderOf, LEAGUES, type Game, type League, type Odds } from '#/domain/game'
import { eventId, gameId, teamId, type TeamId } from '#/domain/ids'
import { LEAGUE_RULES, type LeagueRules, type MarketRules, type PlayKind } from './leagues'
import { createRng, type Rng } from './rng'
import { severityOf } from './severity'

export type SimGame = {
  readonly game: Game
  readonly startsAtTick: number
  readonly elapsed: number
  readonly lastLeader: TeamId | null
}

export type SimState = {
  readonly tick: number
  readonly nextSequence: number
  readonly rngState: number
  readonly games: readonly SimGame[]
}

export type StepResult = { readonly state: SimState; readonly events: readonly GameEvent[] }

type Progress = { readonly drafts: readonly EventDraft[]; readonly elapsed: number }

type Play = (entry: SimGame, rules: LeagueRules, rng: Rng) => readonly EventDraft[]

const MARKETS = ['moneyline', 'spread', 'total'] as const satisfies readonly Market[]

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
  const games = LEAGUES.flatMap((league) => seedLeague(league, rng))
  return { tick: 0, nextSequence: 0, rngState: rng.state(), games }
}

export function step(state: SimState, now: number): StepResult {
  const rng = createRng(state.rngState)
  const tick = state.tick + 1
  let nextSequence = state.nextSequence
  const events: GameEvent[] = []

  const games = state.games.map((entry) => {
    const rules = LEAGUE_RULES[entry.game.league]
    const { drafts, elapsed } = advance(entry, tick, rules, rng)
    let game = entry.game
    for (const draft of drafts) {
      const event: GameEvent = {
        ...draft,
        id: eventId(nextSequence++),
        ts: now,
        gameId: game.id,
        severity: severityOf(draft, game, rules),
      }
      game = applyEvent(game, event)
      events.push(event)
    }
    return { ...entry, game, elapsed, lastLeader: leaderOf(game, game.score) ?? entry.lastLeader }
  })

  return { state: { tick, nextSequence, rngState: rng.state(), games }, events }
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

function seedLeague(league: League, rng: Rng): SimGame[] {
  const rules = LEAGUE_RULES[league]
  const teams = rng.shuffle(rules.teams).map((name) => ({
    id: teamId(`${league}-${name}`.toLowerCase().replaceAll(/[^a-z0-9]+/gu, '-')),
    name,
  }))
  return Array.from({ length: rules.games }, (_, index) => ({
    game: {
      id: gameId(`${league.toLowerCase()}-${index + 1}`),
      league,
      home: teams[index * 2],
      away: teams[index * 2 + 1],
      status: 'scheduled',
      score: { home: 0, away: 0 },
      odds: seedOdds(rules, rng),
    },
    startsAtTick: index === 0 ? 1 : rng.int(2, 40),
    elapsed: 0,
    lastLeader: null,
  }))
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
