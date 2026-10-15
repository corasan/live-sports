import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { formatAge, STALE_AFTER_MS } from '#/feed/freshness'
import type { FeedStore } from '#/feed/store'

const CLOCK_MS = 1000

function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), CLOCK_MS)
    return () => clearInterval(interval)
  }, [])
  return now
}

export function StaleBanner({ store, paused }: { store: FeedStore; paused: boolean }) {
  const syncedAt = useStore(store, (feed) => feed.syncedAt)
  const now = useNow()
  if (syncedAt === null) return null
  const ageMs = now - syncedAt
  if (ageMs <= STALE_AFTER_MS) return null
  return (
    <p
      role="status"
      className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      {paused ? 'Paused.' : 'Live updates delayed.'} Last update {formatAge(ageMs)}
    </p>
  )
}
