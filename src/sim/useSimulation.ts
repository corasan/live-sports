import { useEffect, useState } from 'react'
import { createBatcher } from '#/feed/batcher'
import { receive, type FeedMessage } from '#/feed/feed'
import { createFeedStore } from '#/feed/store'
import { goDown, reconnect, relay, UP, type Link } from './link'
import { createPump, drain } from './pump'
import { DEFAULT_RATE } from './rate'

const MAX_FRAME_MS = 250

function createLiveFeed(seed: number, onOutageChange: (outage: boolean) => void) {
  let pump = createPump(seed)
  let rate = DEFAULT_RATE
  let link: Link = UP
  let outageTimer: ReturnType<typeof setTimeout> | undefined
  const store = createFeedStore(pump.sim.games.map(({ game }) => game))
  const batcher = createBatcher<FeedMessage>((messages) =>
    store.setState((feed) => receive(feed, messages, Date.now()), true),
  )

  const setLink = (next: Link) => {
    link = next
    onOutageChange(next.kind === 'down')
  }

  const resync = (since: number, missed: number): FeedMessage => {
    const dropped = pump.pending.length
    pump = { ...pump, pending: [] }
    const games = pump.sim.games.map(({ game }) => game)
    return { kind: 'resynced', games, since, missed: missed + dropped }
  }

  const endOutage = () => {
    clearTimeout(outageTimer)
    if (link.kind === 'up') return
    const reconnection = reconnect(link, Date.now())
    batcher.push(
      reconnection.kind === 'caught-up'
        ? reconnection
        : resync(reconnection.since, reconnection.missed),
    )
    setLink(UP)
  }

  return {
    store,
    setRate: (next: number) => {
      rate = next
    },
    startOutage: (ms: number) => {
      if (link.kind === 'down') return
      const since = Date.now()
      setLink(goDown(since))
      batcher.push({ kind: 'disconnected', since })
      outageTimer = setTimeout(endOutage, ms)
    },
    endOutage,
    run: () => {
      let last = performance.now()
      let frame = requestAnimationFrame(function pumpFrame(time) {
        const elapsed = Math.min(MAX_FRAME_MS, Math.max(0, time - last))
        const now = Date.now()
        const drained = drain(pump, rate, elapsed, now)
        const relayed = relay(link, drained.events, now)
        last = time
        pump = drained.pump
        link = relayed.link
        if (relayed.delivered.length > 0)
          batcher.push({ kind: 'events', events: relayed.delivered })
        frame = requestAnimationFrame(pumpFrame)
      })
      return () => cancelAnimationFrame(frame)
    },
    dispose: () => {
      clearTimeout(outageTimer)
      batcher.dispose()
    },
  }
}

export function useSimulation(seed: number) {
  const [outage, setOutage] = useState(false)
  const [live] = useState(() => createLiveFeed(seed, setOutage))
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
    outage,
    startOutage: live.startOutage,
    endOutage: live.endOutage,
  }
}
