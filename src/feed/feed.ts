import type { GameEvent } from '#/domain/event'
import { applyEvent, type Game } from '#/domain/game'
import type { EventId, GameId } from '#/domain/ids'
import { at, createRing, push, type Ring } from './ring'

export const FEED_CAPACITY = 20_000

export type Feed = {
  readonly games: ReadonlyMap<GameId, Game>
  readonly gameIds: readonly GameId[]
  readonly events: ReadonlyMap<EventId, GameEvent>
  readonly order: Ring<EventId>
  readonly syncedAt: number | null
}

export function createFeed(games: readonly Game[], capacity = FEED_CAPACITY): Feed {
  return {
    games: new Map(games.map((game) => [game.id, game])),
    gameIds: games.map((game) => game.id),
    events: new Map(),
    order: createRing(capacity),
    syncedAt: null,
  }
}

export function ingest(feed: Feed, batch: readonly GameEvent[], syncedAt: number): Feed {
  if (batch.length === 0) return { ...feed, syncedAt }
  const games = new Map(feed.games)
  const events = new Map(feed.events)
  for (const event of batch) {
    games.set(event.gameId, applyEvent(lookup(games, event.gameId), event))
    events.set(event.id, event)
  }
  const { ring, evicted } = push(
    feed.order,
    batch.map((event) => event.id),
  )
  for (const id of evicted) events.delete(id)
  return { games, gameIds: feed.gameIds, events, order: ring, syncedAt }
}

export function eventAt(feed: Pick<Feed, 'events' | 'order'>, index: number): GameEvent {
  return lookup(feed.events, at(feed.order, index))
}

export function lookup<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key)
  if (value === undefined) throw new Error(`Feed is missing ${String(key)}`)
  return value
}
