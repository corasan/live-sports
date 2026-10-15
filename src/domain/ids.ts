declare const brand: unique symbol

type Brand<B extends string> = string & { readonly [brand]: B }

export type GameId = Brand<'GameId'>
export type TeamId = Brand<'TeamId'>
export type EventId = Brand<'EventId'>

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
const EVENT_SEQUENCE = /^evt-\d+$/u

function isGameId(value: string): value is GameId {
  return SLUG.test(value)
}

function isTeamId(value: string): value is TeamId {
  return SLUG.test(value)
}

function isEventId(value: string): value is EventId {
  return EVENT_SEQUENCE.test(value)
}

export function gameId(value: string): GameId {
  if (!isGameId(value)) throw new Error(`Invalid game id: ${value}`)
  return value
}

export function teamId(value: string): TeamId {
  if (!isTeamId(value)) throw new Error(`Invalid team id: ${value}`)
  return value
}

export function eventId(sequence: number): EventId {
  const value = `evt-${sequence}`
  if (!isEventId(value)) throw new Error(`Invalid event sequence: ${sequence}`)
  return value
}

export function parseEventId(raw: string): EventId | undefined {
  return isEventId(raw) ? raw : undefined
}

export function parseGameId(raw: string): GameId | undefined {
  return isGameId(raw) ? raw : undefined
}
