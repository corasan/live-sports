export type Ring<T> = {
  readonly slots: readonly (T | undefined)[]
  readonly written: number
}

export type Pushed<T> = { readonly ring: Ring<T>; readonly evicted: readonly T[] }

export function createRing<T>(capacity: number): Ring<T> {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error(`Invalid capacity: ${capacity}`)
  return { slots: Array.from({ length: capacity }), written: 0 }
}

export function push<T>(ring: Ring<T>, values: readonly T[]): Pushed<T> {
  const slots = [...ring.slots]
  const evicted: T[] = []
  let written = ring.written
  for (const value of values) {
    const slot = written % slots.length
    const overwritten = slots[slot]
    if (overwritten !== undefined) evicted.push(overwritten)
    slots[slot] = value
    written++
  }
  return { ring: { slots, written }, evicted }
}

export function size<T>(ring: Ring<T>): number {
  return Math.min(ring.slots.length, ring.written)
}

export function at<T>(ring: Ring<T>, age: number): T {
  if (!Number.isInteger(age) || age < 0 || age >= size(ring)) {
    throw new Error(`Ring has no value at age ${age}`)
  }
  const value = ring.slots[(ring.written - 1 - age) % ring.slots.length]
  if (value === undefined) throw new Error(`Ring slot at age ${age} is empty`)
  return value
}
