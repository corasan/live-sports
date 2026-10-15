import type { ReactNode } from 'react'
import { useStore } from 'zustand'
import type { FeedStore } from '#/feed/store'
import type { FeedQuery } from '#/feed/query'
import { selectionSearch, type Selection } from '#/feed/selection'
import { selectedGame } from '#/feed/selectors'
import { EventFeed } from './EventFeed'
import { FeedErrorBoundary } from './FeedErrorBoundary'
import { FeedControls } from './FeedControls'
import { Scoreboard } from './Scoreboard'
import { useDeferredSearch } from './useDeferredSearch'

export function FilteredBoard({
  store,
  query,
  selection,
  panel,
}: {
  store: FeedStore
  query: FeedQuery
  selection: Selection | undefined
  panel: ReactNode
}) {
  const { visible, text, onSearch } = useDeferredSearch(query)
  const game = useStore(store, (feed) => selectedGame(feed, selection))
  return (
    <>
      <FeedControls query={query} text={text} onSearch={onSearch} />
      <Scoreboard store={store} query={visible} selected={game} />
      <div
        className={
          panel === null
            ? undefined
            : 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start'
        }
      >
        <FeedErrorBoundary>
          <EventFeed store={store} query={visible} selected={selectionSearch(selection).event} />
        </FeedErrorBoundary>
        {panel}
      </div>
    </>
  )
}
