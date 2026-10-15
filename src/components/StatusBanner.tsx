import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import type { Recovery } from '#/feed/feed'
import { feedStatus, formatAge, type FeedStatus } from '#/feed/freshness'
import type { FeedStore } from '#/feed/store'

const CLOCK_MS = 1000

const STATUS_STYLE: Readonly<Record<FeedStatus['kind'], string>> = {
  reconnecting: 'border-rose-300 bg-rose-50 text-rose-900',
  recovered: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  stale: 'border-amber-300 bg-amber-50 text-amber-900',
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), CLOCK_MS)
    return () => clearInterval(interval)
  }, [])
  return now
}

function eventNoun(count: number): string {
  return count === 1 ? 'event' : 'events'
}

function recoveryMessage(recovery: Recovery): string {
  switch (recovery.kind) {
    case 'caught-up':
      return `Reconnected. Caught up ${recovery.events} missed ${eventNoun(recovery.events)}.`
    case 'gap':
      return `Reconnected. ${recovery.missed} ${eventNoun(recovery.missed)} could not be recovered; scores resynced.`
  }
}

function statusMessage(status: FeedStatus): string {
  switch (status.kind) {
    case 'reconnecting':
      return `Connection lost ${formatAge(status.lostMs)}. Reconnecting…`
    case 'recovered':
      return recoveryMessage(status.recovery)
    case 'stale':
      return `${status.paused ? 'Paused.' : 'Live updates delayed.'} Last update ${formatAge(status.ageMs)}`
  }
}

export function StatusBanner({ store, paused }: { store: FeedStore; paused: boolean }) {
  const syncedAt = useStore(store, (feed) => feed.syncedAt)
  const connection = useStore(store, (feed) => feed.connection)
  const status = feedStatus({ syncedAt, connection }, useNow(), paused)
  if (status === null) return null
  return (
    <p role="status" className={`rounded border px-3 py-2 text-sm ${STATUS_STYLE[status.kind]}`}>
      {statusMessage(status)}
    </p>
  )
}
