import type { GameEvent } from '#/domain/event'
import { applyEvent, type Game } from '#/domain/game'
import type { EventId, GameId } from '#/domain/ids'
import { at, createRing, push, type Ring } from './ring'

export const FEED_CAPACITY = 20_000

export type Feed = {
  readonly games: ReadonlyMap<GameId, Game>
  readonly gameIds: readonly GameId[]
  readonly events: ReadonlyMap<EventId, GameEvent>
  readonly eventCounts: ReadonlyMap<GameId, number>
  readonly order: Ring<EventId>
  readonly syncedAt: number | null
}

export function createFeed(games: readonly Game[], capacity = FEED_CAPACITY): Feed {
  return {
    games: new Map(games.map((game) => [game.id, game])),
    gameIds: games.map((game) => game.id),
    events: new Map(),
    eventCounts: new Map(),
    order: createRing(capacity),
    syncedAt: null,
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
  return { games, gameIds, events, eventCounts, order: ring, syncedAt }
}

export function eventAt(feed: Pick<Feed, 'events' | 'order'>, index: number): GameEvent {
  return lookup(feed.events, at(feed.order, index))
}

export function lookup<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key)
  if (value === undefined) throw new Error(`Feed is missing ${String(key)}`)
  return value
}
