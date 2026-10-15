import type { FeedQuery } from '#/feed/view'
import { useSimulation } from '#/sim/useSimulation'
import { EventFeed } from './EventFeed'
import { BUTTON, FeedControls } from './FeedControls'
import { Scoreboard } from './Scoreboard'

export function LiveBoard({ seed, query }: { seed: number; query: FeedQuery }) {
  const { store, paused, togglePaused } = useSimulation(seed)
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Live games</h1>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>Seed {seed}</span>
          <button type="button" onClick={togglePaused} className={BUTTON}>
            {paused ? 'Resume simulation' : 'Pause simulation'}
          </button>
        </div>
      </header>
      <FeedControls query={query} />
      <Scoreboard store={store} query={query} />
      <EventFeed store={store} query={query} />
    </main>
  )
}
