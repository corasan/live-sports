import type { FeedStore } from '#/feed/store'
import type { FeedQuery, RelatedScope, Selection } from '#/feed/view'
import { useSimulation } from '#/sim/useSimulation'
import { EventDetailPanel } from './EventDetailPanel'
import { EventFeed } from './EventFeed'
import { BUTTON, FeedControls } from './FeedControls'
import { GameDetailPanel } from './GameDetailPanel'
import { Scoreboard } from './Scoreboard'
import { StaleBanner } from './StaleBanner'
import { StressControls } from './StressControls'

export function LiveBoard({
  seed,
  query,
  selection,
  related,
}: {
  seed: number
  query: FeedQuery
  selection: Selection | undefined
  related: RelatedScope
}) {
  const { store, paused, togglePaused, rate, setRate } = useSimulation(seed)
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Live games</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span>Seed {seed}</span>
          <StressControls store={store} rate={rate} onRateChange={setRate} />
          <button type="button" onClick={togglePaused} className={BUTTON}>
            {paused ? 'Resume simulation' : 'Pause simulation'}
          </button>
        </div>
      </header>
      <StaleBanner store={store} paused={paused} />
      <FeedControls query={query} />
      <Scoreboard
        store={store}
        query={query}
        selected={selection?.kind === 'game' ? selection.id : undefined}
      />
      <div
        className={
          selection === undefined
            ? undefined
            : 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start'
        }
      >
        <EventFeed
          store={store}
          query={query}
          selected={selection?.kind === 'event' ? selection.id : undefined}
        />
        {selection === undefined ? null : (
          <SelectionPanel store={store} selection={selection} related={related} />
        )}
      </div>
    </main>
  )
}

function SelectionPanel({
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
