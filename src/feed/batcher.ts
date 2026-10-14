export const BATCH_WINDOW_MS = 350

export type Frames = {
  readonly request: (callback: () => void) => number
  readonly cancel: (handle: number) => void
}

export type Batcher<T> = { readonly push: (value: T) => void; readonly dispose: () => void }

const ANIMATION_FRAMES: Frames = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
}

const nothingPending = () => {}

export function createBatcher<T>(
  flush: (batch: readonly T[]) => void,
  frames = ANIMATION_FRAMES,
): Batcher<T> {
  let buffer: T[] = []
  let cancelPending = nothingPending

  const release = () => {
    const batch = buffer
    buffer = []
    cancelPending = nothingPending
    flush(batch)
  }

  const awaitFrame = () => {
    const frame = frames.request(release)
    cancelPending = () => frames.cancel(frame)
  }

  return {
    push: (value) => {
      buffer.push(value)
      if (buffer.length > 1) return
      const timer = setTimeout(awaitFrame, BATCH_WINDOW_MS)
      cancelPending = () => clearTimeout(timer)
    },
    dispose: () => {
      cancelPending()
      cancelPending = nothingPending
      buffer = []
    },
  }
}
