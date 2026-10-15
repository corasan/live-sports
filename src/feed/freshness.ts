import type { Feed, Recovery } from './feed'

export const STALE_AFTER_MS = 5000

export const RECOVERED_FOR_MS = 5000

export type FeedStatus =
  | { readonly kind: 'reconnecting'; readonly lostMs: number }
  | { readonly kind: 'recovered'; readonly recovery: Recovery }
  | { readonly kind: 'stale'; readonly ageMs: number; readonly paused: boolean }

export function formatAge(ms: number): string {
  return ms < 60_000 ? `${Math.floor(ms / 1000)}s ago` : `${Math.floor(ms / 60_000)}m ago`
}

export function feedStatus(
  feed: Pick<Feed, 'syncedAt' | 'connection'>,
  now: number,
  paused: boolean,
): FeedStatus | null {
  const { connection, syncedAt } = feed
  if (connection.kind === 'reconnecting') {
    return { kind: 'reconnecting', lostMs: now - connection.since }
  }
  if (connection.kind === 'recovered' && now - connection.at <= RECOVERED_FOR_MS) {
    return { kind: 'recovered', recovery: connection.recovery }
  }
  if (syncedAt === null || now - syncedAt <= STALE_AFTER_MS) return null
  return { kind: 'stale', ageMs: now - syncedAt, paused }
}
