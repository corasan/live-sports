import { useEffect, useState } from 'react'
import type { FeedStore } from '#/feed/store'

export type FrameStats = {
  readonly fps: number
  readonly worstFrameMs: number
  readonly ingestedPerSecond: number
}

type Arrival = { readonly time: number; readonly written: number }

const SAMPLE_MS = 500
const INGEST_WINDOW_MS = 2000

const NO_STATS: FrameStats = { fps: 0, worstFrameMs: 0, ingestedPerSecond: 0 }

function ingestRate(arrivals: readonly Arrival[]): number {
  const first = arrivals.at(0)
  const last = arrivals.at(-1)
  if (first === undefined || last === undefined || last.time === first.time) return 0
  return ((last.written - first.written) * 1000) / (last.time - first.time)
}

export function useFrameStats(store: FeedStore): FrameStats {
  const [stats, setStats] = useState(NO_STATS)

  useEffect(() => {
    let sampleStart = performance.now()
    let previous = sampleStart
    let frames = 0
    let worst = 0
    let lastWritten = store.getState().order.written
    let arrivals: Arrival[] = []

    let frame = requestAnimationFrame(function measure(time) {
      frames++
      worst = Math.max(worst, time - previous)
      previous = time
      const { written } = store.getState().order
      if (written !== lastWritten) {
        arrivals.push({ time, written })
        lastWritten = written
      }
      const span = time - sampleStart
      if (span >= SAMPLE_MS) {
        arrivals = arrivals.filter((arrival) => time - arrival.time <= INGEST_WINDOW_MS)
        setStats({
          fps: (frames * 1000) / span,
          worstFrameMs: worst,
          ingestedPerSecond: ingestRate(arrivals),
        })
        sampleStart = time
        frames = 0
        worst = 0
      }
      frame = requestAnimationFrame(measure)
    })
    return () => cancelAnimationFrame(frame)
  }, [store])

  return stats
}
