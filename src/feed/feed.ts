import type { GameEvent } from '#/domain/event'
import { applyEvent, type Game } from '#/domain/game'
import type { EventId, GameId } from '#/domain/ids'
import { at, createRing, push, type Ring } from './ring'

export const FEED_CAPACITY = 20_000

export type Recovery =
  | { readonly kind: 'caught-up'; readonly events: number }
  | { readonly kind: 'gap'; readonly missed: number }

export type Connection =
  | { readonly kind: 'live' }
  | { readonly kind: 'reconnecting'; readonly since: number }
  | { readonly kind: 'recovered'; readonly at: number; readonly recovery: Recovery }

export type Gap = {
  readonly at: number
  readonly from: number
  readonly to: number
  readonly missed: number
}

export type Feed = {
  readonly games: ReadonlyMap<GameId, Game>
  readonly gameIds: readonly GameId[]
  readonly events: ReadonlyMap<EventId, GameEvent>
  readonly eventCounts: ReadonlyMap<GameId, number>
  readonly order: Ring<EventId>
  readonly syncedAt: number | null
  readonly connection: Connection
  readonly gaps: readonly Gap[]
}

export type FeedMessage =
  | { readonly kind: 'events'; readonly events: readonly GameEvent[] }
  | { readonly kind: 'disconnected'; readonly since: number }
  | { readonly kind: 'caught-up'; readonly events: readonly GameEvent[] }
  | {
      readonly kind: 'resynced'
      readonly games: readonly Game[]
      readonly since: number
      readonly missed: number
    }

const LIVE: Connection = { kind: 'live' }

const NO_GAPS: readonly Gap[] = []

export function createFeed(games: readonly Game[], capacity = FEED_CAPACITY): Feed {
  return {
    games: new Map(games.map((game) => [game.id, game])),
    gameIds: games.map((game) => game.id),
    events: new Map(),
    eventCounts: new Map(),
    order: createRing(capacity),
    syncedAt: null,
    connection: LIVE,
    gaps: NO_GAPS,
  }
}

export function ingest(feed: Feed, batch: readonly GameEvent[], syncedAt: number): Feed {
  if (batch.length === 0) return { ...feed, syncedAt }
  const games = new Map(feed.games)
  const events = new Map(feed.events)
  const eventCounts = new Map(feed.eventCounts)
  let gameIds = feed.gameIds
  const retiring = new Set<GameId>()
  const count = (id: GameId, delta: number) => {
    const next = (eventCounts.get(id) ?? 0) + delta
    if (next === 0) eventCounts.delete(id)
    else eventCounts.set(id, next)
  }

  for (const event of batch) {
    if (event.kind === 'game_scheduled') {
      games.set(event.gameId, event.game)
      gameIds = gameIds.map((id) => (id === event.replaces ? event.gameId : id))
      retiring.add(event.replaces)
    } else {
      games.set(event.gameId, applyEvent(lookup(games, event.gameId), event))
    }
    events.set(event.id, event)
    count(event.gameId, 1)
  }
  const { ring, evicted } = push(
    feed.order,
    batch.map((event) => event.id),
  )
  for (const id of evicted) {
    const { gameId } = lookup(events, id)
    events.delete(id)
    count(gameId, -1)
    retiring.add(gameId)
  }
  for (const id of retiring) {
    if (!eventCounts.has(id) && !gameIds.includes(id)) games.delete(id)
  }
  return {
    ...feed,
    games,
    gameIds,
    events,
    eventCounts,
    order: ring,
    syncedAt,
    gaps: pruneGaps(feed.gaps, ring),
  }
}

function pruneGaps(gaps: readonly Gap[], order: Ring<EventId>): readonly Gap[] {
  const floor = order.written - order.slots.length
  return gaps.some((gap) => gap.at <= floor) ? gaps.filter((gap) => gap.at > floor) : gaps
}

function addGap(gaps: readonly Gap[], gap: Gap): readonly Gap[] {
  const last = gaps.at(-1)
  if (last?.at !== gap.at) return [...gaps, gap]
  return [...gaps.slice(0, -1), { ...last, to: gap.to, missed: last.missed + gap.missed }]
}

function resync(
  feed: Feed,
  slate: readonly Game[],
  since: number,
  missed: number,
  now: number,
): Feed {
  const gameIds = slate.map((game) => game.id)
  const games = new Map(feed.games)
  for (const game of slate) games.set(game.id, game)
  for (const id of feed.games.keys()) {
    if (!feed.eventCounts.has(id) && !gameIds.includes(id)) games.delete(id)
  }
  return {
    ...feed,
    games,
    gameIds,
    syncedAt: now,
    gaps: addGap(feed.gaps, { at: feed.order.written, from: since, to: now, missed }),
    connection: { kind: 'recovered', at: now, recovery: { kind: 'gap', missed } },
  }
}

function apply(feed: Feed, message: FeedMessage, now: number): Feed {
  switch (message.kind) {
    case 'events':
      return ingest(feed, message.events, now)
    case 'disconnected':
      return { ...feed, connection: { kind: 'reconnecting', since: message.since } }
    case 'caught-up':
      return {
        ...ingest(feed, message.events, now),
        connection: {
          kind: 'recovered',
          at: now,
          recovery: { kind: 'caught-up', events: message.events.length },
        },
      }
    case 'resynced':
      return resync(feed, message.games, message.since, message.missed, now)
  }
}

function coalesce(messages: readonly FeedMessage[]): readonly FeedMessage[] {
  const merged: FeedMessage[] = []
  for (const message of messages) {
    const last = merged.at(-1)
    if (message.kind === 'events' && last?.kind === 'events') {
      merged[merged.length - 1] = { kind: 'events', events: [...last.events, ...message.events] }
    } else {
      merged.push(message)
    }
  }
  return merged
}

export function receive(feed: Feed, messages: readonly FeedMessage[], now: number): Feed {
  return coalesce(messages).reduce((next, message) => apply(next, message, now), feed)
}

export function eventAt(feed: Pick<Feed, 'events' | 'order'>, index: number): GameEvent {
  return lookup(feed.events, at(feed.order, index))
}

export function lookup<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key)
  if (value === undefined) throw new Error(`Feed is missing ${String(key)}`)
  return value
}
