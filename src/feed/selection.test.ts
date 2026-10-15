import { describe, expect, it } from 'vitest'
import { eventId, gameId } from '#/domain/ids'
import { simulatedFeed } from './fixtures'
import { DEFAULT_QUERY } from './query'
import { parseSelection, stepSelection } from './selection'
import { selectFeedRows } from './selectors'

const { feed } = simulatedFeed(7, 120, 20_000)

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

describe('stepSelection', () => {
  const rows = selectFeedRows(feed, { ...DEFAULT_QUERY, group: 'game' })
  const ids = rows.flatMap((row) => (row.kind === 'event' ? [row.key] : []))
  const headers = rows.filter((row) => row.kind === 'group').map((row) => row.key)

  it('starts at the first event row in either direction when nothing is selected', () => {
    expect(rows[0].kind).toBe('group')
    expect(stepSelection(rows, undefined, 1)).toEqual({ id: ids[0], index: 1 })
    expect(stepSelection(rows, undefined, -1)?.id).toBe(ids[0])
    expect(stepSelection(rows, eventId(999_999), -1)?.id).toBe(ids[0])
  })

  it('walks every event row in order, skipping group headers', () => {
    const visited = [ids[0]]
    for (let i = 1; i < ids.length; i++) {
      const step = stepSelection(rows, visited[i - 1], 1)
      expect(step === null ? null : rows[step.index].key).toBe(step?.id)
      visited.push(step?.id ?? ids[0])
    }
    expect(visited).toEqual(ids)
    expect(headers.length).toBeGreaterThan(1)
  })

  it('clamps at both ends instead of wrapping', () => {
    expect(stepSelection(rows, ids[0], -1)?.id).toBe(ids[0])
    expect(stepSelection(rows, ids.at(-1), 1)?.id).toBe(ids.at(-1))
  })

  it('selects nothing when there are no event rows', () => {
    expect(stepSelection([], undefined, 1)).toBeNull()
    expect(stepSelection([{ kind: 'group', key: 'group:x', label: 'X' }], ids[0], -1)).toBeNull()
  })
})
