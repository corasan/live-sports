import type { EventId } from '#/domain/ids'
import type { FeedQuery, RelatedScope } from '#/feed/view'
import { useSimulation } from '#/sim/useSimulation'
import { EventDetailPanel } from './EventDetailPanel'
import { EventFeed } from './EventFeed'
import { BUTTON, FeedControls } from './FeedControls'
import { Scoreboard } from './Scoreboard'
import { StaleBanner } from './StaleBanner'
import { StressControls } from './StressControls'

export function LiveBoard({
  seed,
  query,
  selected,
  related,
}: {
  seed: number
  query: FeedQuery
  selected: EventId | undefined
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
      <Scoreboard store={store} query={query} />
      <div
        className={
          selected === undefined
            ? undefined
            : 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start'
        }
      >
        <EventFeed store={store} query={query} selected={selected} />
        {selected === undefined ? null : (
          <EventDetailPanel store={store} selected={selected} related={related} />
        )}
      </div>
    </main>
  )
}
