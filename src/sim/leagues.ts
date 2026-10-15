import type { Market } from '#/domain/event'
import type { League } from '#/domain/game'
import type { NonEmpty, Weighted } from './rng'

export type PlayKind = 'score' | 'odds_shift' | 'injury' | 'quiet'

export type MarketRules = {
  readonly min: number
  readonly max: number
  readonly unit: number
  readonly maxUnits: number
  readonly notableShift: number
}

export type LeagueRules = {
  readonly games: number
  readonly periods: number
  readonly ticksPerPeriod: number
  readonly scoring: NonEmpty<Weighted<number>>
  readonly plays: NonEmpty<Weighted<PlayKind>>
  readonly markets: Readonly<Record<Market, MarketRules>>
}

const MONEYLINE: MarketRules = { min: 5, max: 95, unit: 1, maxUnits: 8, notableShift: 6 }

export const LEAGUE_RULES: Readonly<Record<League, LeagueRules>> = {
  NBA: {
    games: 3,
    periods: 4,
    ticksPerPeriod: 12,
    scoring: [
      { weight: 6, value: 2 },
      { weight: 3, value: 3 },
      { weight: 2, value: 1 },
    ],
    plays: [
      { weight: 7, value: 'score' },
      { weight: 1.5, value: 'odds_shift' },
      { weight: 0.15, value: 'injury' },
      { weight: 2, value: 'quiet' },
    ],
    markets: {
      moneyline: MONEYLINE,
      spread: { min: -12, max: 12, unit: 0.5, maxUnits: 4, notableShift: 1.5 },
      total: { min: 200, max: 240, unit: 0.5, maxUnits: 8, notableShift: 3 },
    },
  },
  NFL: {
    games: 2,
    periods: 4,
    ticksPerPeriod: 12,
    scoring: [
      { weight: 5, value: 7 },
      { weight: 3, value: 3 },
      { weight: 1, value: 6 },
      { weight: 0.3, value: 2 },
    ],
    plays: [
      { weight: 1.2, value: 'score' },
      { weight: 1.5, value: 'odds_shift' },
      { weight: 0.2, value: 'injury' },
      { weight: 6, value: 'quiet' },
    ],
    markets: {
      moneyline: MONEYLINE,
      spread: { min: -10, max: 10, unit: 0.5, maxUnits: 4, notableShift: 1.5 },
      total: { min: 36, max: 54, unit: 0.5, maxUnits: 6, notableShift: 2 },
    },
  },
  NHL: {
    games: 3,
    periods: 3,
    ticksPerPeriod: 15,
    scoring: [{ weight: 1, value: 1 }],
    plays: [
      { weight: 0.6, value: 'score' },
      { weight: 1.2, value: 'odds_shift' },
      { weight: 0.1, value: 'injury' },
      { weight: 7, value: 'quiet' },
    ],
    markets: {
      moneyline: MONEYLINE,
      spread: { min: -2.5, max: 2.5, unit: 0.5, maxUnits: 2, notableShift: 1 },
      total: { min: 4.5, max: 7.5, unit: 0.5, maxUnits: 2, notableShift: 1 },
    },
  },
}
