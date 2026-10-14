import { useEffect, useState } from 'react'
import { ingest } from '#/feed/feed'
import { createFeedStore } from '#/feed/store'
import { createSimulation, step } from './simulation'

const TICK_MS = 1000

function createLiveFeed(seed: number) {
  let sim = createSimulation(seed)
  const store = createFeedStore(sim.games.map(({ game }) => game))
  return {
    store,
    tick: (now: number) => {
      const { state, events } = step(sim, now)
      sim = state
      store.setState((feed) => ingest(feed, events), true)
    },
  }
}

export function useSimulation(seed: number) {
  const [live] = useState(() => createLiveFeed(seed))
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const interval = setInterval(() => live.tick(Date.now()), TICK_MS)
    return () => clearInterval(interval)
  }, [live, paused])

  return {
    store: live.store,
    paused,
    togglePaused: () => setPaused((current) => !current),
  }
}
