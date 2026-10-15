import { parseEventId, parseGameId, type EventId, type GameId } from '#/domain/ids'
import type { FeedRow } from './selectors'

export type Selection =
  | { readonly kind: 'event'; readonly id: EventId }
  | { readonly kind: 'game'; readonly id: GameId }

export type SelectionSearch = {
  readonly event: EventId | undefined
  readonly game: GameId | undefined
}

export type Step = { readonly id: EventId; readonly index: number }

export function parseSelection(raw: {
  readonly event?: string
  readonly game?: string
}): Selection | undefined {
  const event = raw.event === undefined ? undefined : parseEventId(raw.event)
  if (event !== undefined) return { kind: 'event', id: event }
  const game = raw.game === undefined ? undefined : parseGameId(raw.game)
  return game === undefined ? undefined : { kind: 'game', id: game }
}

export function selectionSearch(selection: Selection | undefined): SelectionSearch {
  return {
    event: selection?.kind === 'event' ? selection.id : undefined,
    game: selection?.kind === 'game' ? selection.id : undefined,
  }
}

export function stepSelection(
  rows: readonly FeedRow[],
  selected: EventId | undefined,
  delta: 1 | -1,
): Step | null {
  const current = selected === undefined ? -1 : rows.findIndex((row) => row.key === selected)
  const direction = current === -1 ? 1 : delta
  for (let index = current + direction; index >= 0 && index < rows.length; index += direction) {
    const row = rows[index]
    if (row.kind === 'event') return { id: row.key, index }
  }
  const stay = rows.at(current)
  return current !== -1 && stay?.kind === 'event' ? { id: stay.key, index: current } : null
}
