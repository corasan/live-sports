import type { FeedQuery } from '#/feed/query'
import { selectionSearch, type Selection } from '#/feed/selection'
import { useSimulation } from '#/sim/useSimulation'
import { FilteredBoard } from './FilteredBoard'
import { GameDetailPanel } from './GameDetailPanel'
import { OutageControls } from './OutageControls'
import { StatusBanner } from './StatusBanner'
import { StressControls } from './StressControls'
import { BUTTON } from './styles'

export function LiveBoard({
  seed,
  query,
  selection,
}: {
  seed: number
  query: FeedQuery
  selection: Selection | undefined
}) {
  const { store, paused, togglePaused, rate, setRate, outage, startOutage, endOutage } =
    useSimulation(seed)
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Live games</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span>Seed {seed}</span>
          <StressControls store={store} rate={rate} onRateChange={setRate} />
          <OutageControls outage={outage} onStart={startOutage} onEnd={endOutage} />
          <button type="button" onClick={togglePaused} className={BUTTON}>
            {paused ? 'Resume simulation' : 'Pause simulation'}
          </button>
        </div>
      </header>
      <StatusBanner store={store} paused={paused} />
      <FilteredBoard
        store={store}
        query={query}
        selected={selectionSearch(selection)}
        panel={
          selection === undefined ? null : <GameDetailPanel store={store} selection={selection} />
        }
      />
    </main>
  )
}
