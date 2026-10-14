import { useEffect, useState } from 'react'
import type { GameEvent } from '#/domain/event'
import { createSimulation, step, type SimState } from './simulation'

const TICK_MS = 1000
const LOG_LIMIT = 60

type Feed = { readonly sim: SimState; readonly log: readonly GameEvent[] }

function advance(feed: Feed, now: number): Feed {
  const { state, events } = step(feed.sim, now)
  return { sim: state, log: [...events.toReversed(), ...feed.log].slice(0, LOG_LIMIT) }
}

export function useSimulation(seed: number) {
  const [feed, setFeed] = useState<Feed>(() => ({ sim: createSimulation(seed), log: [] }))
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const interval = setInterval(() => {
      const now = Date.now()
      setFeed((current) => advance(current, now))
    }, TICK_MS)
    return () => clearInterval(interval)
  }, [paused])

  return {
    seed,
    games: feed.sim.games.map(({ game }) => game),
    log: feed.log,
    paused,
    togglePaused: () => setPaused((current) => !current),
  }
}
