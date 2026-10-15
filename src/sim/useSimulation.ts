import { useEffect, useState } from 'react'
import type { GameEvent } from '#/domain/event'
import { createBatcher } from '#/feed/batcher'
import { ingest } from '#/feed/feed'
import { createFeedStore } from '#/feed/store'
import { createPump, drain } from './pump'
import { DEFAULT_RATE } from './rate'

const MAX_FRAME_MS = 250

function createLiveFeed(seed: number) {
  let pump = createPump(seed)
  let rate = DEFAULT_RATE
  const store = createFeedStore(pump.sim.games.map(({ game }) => game))
  const batcher = createBatcher<readonly GameEvent[]>((frames) =>
    store.setState((feed) => ingest(feed, frames.flat(), Date.now()), true),
  )
  return {
    store,
    setRate: (next: number) => {
      rate = next
    },
    run: () => {
      let last = performance.now()
      let frame = requestAnimationFrame(function pumpFrame(time) {
        const elapsed = Math.min(MAX_FRAME_MS, Math.max(0, time - last))
        const result = drain(pump, rate, elapsed, Date.now())
        last = time
        pump = result.pump
        batcher.push(result.events)
        frame = requestAnimationFrame(pumpFrame)
      })
      return () => cancelAnimationFrame(frame)
    },
    dispose: batcher.dispose,
  }
}

export function useSimulation(seed: number) {
  const [live] = useState(() => createLiveFeed(seed))
  const [paused, setPaused] = useState(false)
  const [rate, setRate] = useState(DEFAULT_RATE)

  useEffect(() => live.dispose, [live])

  useEffect(() => live.setRate(rate), [live, rate])

  useEffect(() => (paused ? undefined : live.run()), [live, paused])

  return {
    store: live.store,
    paused,
    togglePaused: () => setPaused((current) => !current),
    rate,
    setRate,
  }
}
