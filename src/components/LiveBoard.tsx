import { useSimulation } from '#/sim/useSimulation'
import { EventFeed } from './EventFeed'
import { Scoreboard } from './Scoreboard'

export function LiveBoard({ seed }: { seed: number }) {
  const { games, log, paused, togglePaused } = useSimulation(seed)
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Live games</h1>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>Seed {seed}</span>
          <button
            type="button"
            onClick={togglePaused}
            className="rounded border border-slate-300 px-3 py-1 font-medium text-slate-700 hover:bg-slate-100"
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </header>
      <Scoreboard games={games} />
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Feed</h2>
        {log.length === 0 ? (
          <p className="text-sm text-slate-500">Waiting for tip-off…</p>
        ) : (
          <EventFeed events={log} games={games} />
        )}
      </section>
    </main>
  )
}
