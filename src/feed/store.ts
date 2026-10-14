import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Game } from '#/domain/game'
import { createFeed, type Feed } from './feed'

export type FeedStore = StoreApi<Feed>

export function createFeedStore(games: readonly Game[]): FeedStore {
  return createStore<Feed>()(() => createFeed(games))
}
