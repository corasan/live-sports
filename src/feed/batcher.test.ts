import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BATCH_WINDOW_MS, createBatcher, type Frames } from './batcher'

const FRAME_MS = 16

const timerFrames: Frames = {
  request: (callback) => Number(setTimeout(callback, FRAME_MS)),
  cancel: (handle) => clearTimeout(handle),
}

function recordBatches() {
  const batches: (readonly number[])[] = []
  const batcher = createBatcher<number>((batch) => batches.push(batch), timerFrames)
  return { batches, batcher }
}

describe('batcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('coalesces every push in the window into one flush on the next frame', () => {
    const { batches, batcher } = recordBatches()
    for (let i = 0; i < 100; i++) batcher.push(i)
    vi.advanceTimersByTime(BATCH_WINDOW_MS)
    expect(batches).toEqual([])
    vi.advanceTimersByTime(FRAME_MS)
    expect(batches).toEqual([Array.from({ length: 100 }, (_, i) => i)])
  })

  it('times the window from the first push, not the latest', () => {
    const { batches, batcher } = recordBatches()
    batcher.push(1)
    vi.advanceTimersByTime(BATCH_WINDOW_MS - 1)
    batcher.push(2)
    vi.advanceTimersByTime(1 + FRAME_MS)
    expect(batches).toEqual([[1, 2]])
  })

  it('folds pushes that land while waiting for the frame into the same flush', () => {
    const { batches, batcher } = recordBatches()
    batcher.push(1)
    vi.advanceTimersByTime(BATCH_WINDOW_MS)
    batcher.push(2)
    vi.advanceTimersByTime(FRAME_MS)
    expect(batches).toEqual([[1, 2]])
  })

  it('opens a fresh window after a flush', () => {
    const { batches, batcher } = recordBatches()
    batcher.push(1)
    vi.advanceTimersByTime(BATCH_WINDOW_MS + FRAME_MS)
    batcher.push(2)
    vi.advanceTimersByTime(BATCH_WINDOW_MS + FRAME_MS)
    expect(batches).toEqual([[1], [2]])
  })

  it.each([
    ['during the window', 0],
    ['while waiting for the frame', BATCH_WINDOW_MS],
  ])('never flushes once disposed %s', (_, elapsed) => {
    const { batches, batcher } = recordBatches()
    batcher.push(1)
    vi.advanceTimersByTime(elapsed)
    batcher.dispose()
    vi.advanceTimersByTime(BATCH_WINDOW_MS + FRAME_MS)
    expect(batches).toEqual([])
  })
})
