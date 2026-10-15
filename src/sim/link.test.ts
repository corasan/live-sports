import { describe, expect, it } from 'vitest'
import type { GameEvent } from '#/domain/event'
import { simulate } from '#/feed/fixtures'
import { goDown, reconnect, relay, REPLAY_WINDOW_MS, UP, type Link } from './link'

const batches = simulate(5, 30).batches.filter((batch) => batch.length > 0)

function relayAll(link: Link, steps: readonly (readonly [readonly GameEvent[], number])[]) {
  let current = link
  const delivered: GameEvent[] = []
  for (const [events, now] of steps) {
    const result = relay(current, events, now)
    current = result.link
    delivered.push(...result.delivered)
  }
  return { link: current, delivered }
}

function down(link: Link) {
  if (link.kind !== 'down') throw new Error('Expected the link to be down')
  return link
}

describe('relay', () => {
  it('delivers every event while the link is up', () => {
    const { link, delivered } = relayAll(UP, [
      [batches[0], 0],
      [batches[1], 1000],
    ])
    expect(link).toBe(UP)
    expect(delivered).toEqual([...batches[0], ...batches[1]])
  })

  it('withholds events while down and replays them in arrival order on a short outage', () => {
    const { link, delivered } = relayAll(goDown(0), [
      [batches[0], 1000],
      [[], 2000],
      [batches[1], 3000],
      [batches[2], REPLAY_WINDOW_MS],
    ])
    expect(delivered).toEqual([])
    expect(reconnect(down(link), REPLAY_WINDOW_MS)).toEqual({
      kind: 'caught-up',
      events: [...batches[0], ...batches[1], ...batches[2]],
    })
  })

  it('drops the backlog to a count once the outage outlasts the replay window', () => {
    const { link } = relayAll(goDown(0), [
      [batches[0], 1000],
      [batches[1], REPLAY_WINDOW_MS + 1],
      [batches[2], REPLAY_WINDOW_MS + 2000],
    ])
    const missed = batches[0].length + batches[1].length + batches[2].length
    expect(down(link).backlog).toEqual({ kind: 'expired', missed })
    expect(reconnect(down(link), REPLAY_WINDOW_MS + 3000)).toEqual({
      kind: 'gap',
      since: 0,
      missed,
    })
  })
})

describe('reconnect', () => {
  it('reports a gap when a still-replayable backlog is reconnected after the window', () => {
    const { link } = relay(goDown(0), batches[0], 1000)
    expect(reconnect(down(link), REPLAY_WINDOW_MS + 1)).toEqual({
      kind: 'gap',
      since: 0,
      missed: batches[0].length,
    })
  })

  it('catches up with nothing when a long outage missed no events', () => {
    const { link } = relayAll(goDown(0), [
      [[], 1000],
      [[], REPLAY_WINDOW_MS + 5000],
    ])
    expect(down(link).backlog).toEqual({ kind: 'expired', missed: 0 })
    expect(reconnect(down(link), REPLAY_WINDOW_MS * 3)).toEqual({ kind: 'caught-up', events: [] })
  })
})
