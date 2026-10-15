import type { FeedStore } from '#/feed/store'
import type { Selection } from '#/feed/selection'
import { EventDetailPanel } from './EventDetailPanel'
import { GameDetailPanel } from './GameDetailPanel'

export function SelectionPanel({ store, selection }: { store: FeedStore; selection: Selection }) {
  switch (selection.kind) {
    case 'event':
      return <EventDetailPanel store={store} selected={selection.id} />
    case 'game':
      return <GameDetailPanel store={store} selected={selection.id} />
  }
}
