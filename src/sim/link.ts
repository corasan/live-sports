import type { GameEvent } from '#/domain/event'

export const REPLAY_WINDOW_MS = 10_000

export type Backlog =
  | { readonly kind: 'replayable'; readonly events: readonly GameEvent[] }
  | { readonly kind: 'expired'; readonly missed: number }

export type Down = { readonly kind: 'down'; readonly since: number; readonly backlog: Backlog }

export type Link = { readonly kind: 'up' } | Down

export type Reconnection =
  | { readonly kind: 'caught-up'; readonly events: readonly GameEvent[] }
  | { readonly kind: 'gap'; readonly since: number; readonly missed: number }

export type Relayed = { readonly link: Link; readonly delivered: readonly GameEvent[] }

export const UP: Link = { kind: 'up' }

const NOTHING: readonly GameEvent[] = []

export function goDown(since: number): Down {
  return { kind: 'down', since, backlog: { kind: 'replayable', events: NOTHING } }
}

function missedCount(backlog: Backlog): number {
  return backlog.kind === 'replayable' ? backlog.events.length : backlog.missed
}

function append(backlog: Backlog, events: readonly GameEvent[], expired: boolean): Backlog {
  if (events.length === 0 && (backlog.kind === 'expired' || !expired)) return backlog
  if (expired || backlog.kind === 'expired') {
    return { kind: 'expired', missed: missedCount(backlog) + events.length }
  }
  return { kind: 'replayable', events: [...backlog.events, ...events] }
}

function outlasted(link: Down, now: number): boolean {
  return now - link.since > REPLAY_WINDOW_MS
}

export function relay(link: Link, events: readonly GameEvent[], now: number): Relayed {
  if (link.kind === 'up') return { link, delivered: events }
  const backlog = append(link.backlog, events, outlasted(link, now))
  return { link: backlog === link.backlog ? link : { ...link, backlog }, delivered: NOTHING }
}

export function reconnect(link: Down, now: number): Reconnection {
  const missed = missedCount(link.backlog)
  if (outlasted(link, now) && missed > 0) return { kind: 'gap', since: link.since, missed }
  return {
    kind: 'caught-up',
    events: link.backlog.kind === 'replayable' ? link.backlog.events : NOTHING,
  }
}
