import type { FeedStore } from '#/feed/store'
import type { RelatedScope, Selection } from '#/feed/selection'
import { EventDetailPanel } from './EventDetailPanel'
import { GameDetailPanel } from './GameDetailPanel'

export function SelectionPanel({
  store,
  selection,
  related,
}: {
  store: FeedStore
  selection: Selection
  related: RelatedScope
}) {
  switch (selection.kind) {
    case 'event':
      return <EventDetailPanel store={store} selected={selection.id} related={related} />
    case 'game':
      return <GameDetailPanel store={store} selected={selection.id} />
  }
}
