export type NonEmpty<T> = readonly [T, ...T[]]

export type Weighted<T> = { readonly weight: number; readonly value: T }

export type Rng = {
  readonly float: () => number
  readonly int: (min: number, max: number) => number
  readonly pick: <T>(items: NonEmpty<T>) => T
  readonly weighted: <T>(items: NonEmpty<Weighted<T>>) => T
  readonly shuffle: <T>(items: readonly T[]) => T[]
  readonly state: () => number
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0

  const float = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const int = (min: number, max: number) => min + Math.floor(float() * (max - min + 1))

  return {
    float,
    int,
    pick: (items) => items[int(0, items.length - 1)],
    weighted: (items) => {
      let roll = float() * items.reduce((sum, item) => sum + item.weight, 0)
      for (const item of items) {
        roll -= item.weight
        if (roll < 0) return item.value
      }
      return items[items.length - 1].value
    },
    shuffle: (items) => {
      const result = [...items]
      for (let i = result.length - 1; i > 0; i--) {
        const j = int(0, i)
        ;[result[i], result[j]] = [result[j], result[i]]
      }
      return result
    },
    state: () => state,
  }
}
