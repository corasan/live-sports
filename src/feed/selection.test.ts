import { describe, expect, it } from 'vitest'
import { eventId, gameId } from '#/domain/ids'
import { parseSelection } from './selection'

describe('parseSelection', () => {
  const event = eventId(12)
  const game = gameId('nba-3')

  it('parses a single event or game selection', () => {
    expect(parseSelection({ event })).toEqual({ kind: 'event', id: event })
    expect(parseSelection({ game })).toEqual({ kind: 'game', id: game })
  })

  it('prefers the event when both arrive', () => {
    expect(parseSelection({ event, game })).toEqual({ kind: 'event', id: event })
  })

  it('ignores malformed and missing ids', () => {
    expect(parseSelection({})).toBeUndefined()
    expect(parseSelection({ event: 'nope', game: 'Not A Slug' })).toBeUndefined()
    expect(parseSelection({ event: '42', game: 'nba-3' })).toEqual({ kind: 'game', id: game })
  })
})
