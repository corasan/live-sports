import type { ReactNode } from 'react'
import type { FeedStore } from '#/feed/store'
import type { FeedQuery } from '#/feed/query'
import type { SelectionSearch } from '#/feed/selection'
import { EventFeed } from './EventFeed'
import { FeedErrorBoundary } from './FeedErrorBoundary'
import { FeedControls } from './FeedControls'
import { Scoreboard } from './Scoreboard'
import { useDeferredSearch } from './useDeferredSearch'

export function FilteredBoard({
  store,
  query,
  selected,
  panel,
}: {
  store: FeedStore
  query: FeedQuery
  selected: SelectionSearch
  panel: ReactNode
}) {
  const { visible, text, onSearch } = useDeferredSearch(query)
  return (
    <>
      <FeedControls query={query} text={text} onSearch={onSearch} />
      <Scoreboard store={store} query={visible} selected={selected.game} />
      <div
        className={
          panel === null
            ? undefined
            : 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start'
        }
      >
        <FeedErrorBoundary>
          <EventFeed store={store} query={visible} selected={selected.event} />
        </FeedErrorBoundary>
        {panel}
      </div>
    </>
  )
}
