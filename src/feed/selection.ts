import { parseEventId, parseGameId, type EventId, type GameId } from '#/domain/ids'

export const RELATED_SCOPES = ['game', 'drive'] as const

export type RelatedScope = (typeof RELATED_SCOPES)[number]

export const DEFAULT_RELATED: RelatedScope = 'game'

export type Selection =
  | { readonly kind: 'event'; readonly id: EventId }
  | { readonly kind: 'game'; readonly id: GameId }

export type SelectionSearch = {
  readonly event: EventId | undefined
  readonly game: GameId | undefined
}

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
