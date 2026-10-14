export type Ring<T> = {
  readonly slots: readonly (T | undefined)[]
  readonly head: number
  readonly size: number
}

export type Pushed<T> = { readonly ring: Ring<T>; readonly evicted: readonly T[] }

export function createRing<T>(capacity: number): Ring<T> {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error(`Invalid capacity: ${capacity}`)
  return { slots: Array.from({ length: capacity }), head: 0, size: 0 }
}

export function push<T>(ring: Ring<T>, values: readonly T[]): Pushed<T> {
  const slots = [...ring.slots]
  const evicted: T[] = []
  let head = ring.head
  for (const value of values) {
    const overwritten = slots[head]
    if (overwritten !== undefined) evicted.push(overwritten)
    slots[head] = value
    head = (head + 1) % slots.length
  }
  return {
    ring: { slots, head, size: Math.min(slots.length, ring.size + values.length) },
    evicted,
  }
}

export function newest<T>(ring: Ring<T>, n: number): T[] {
  const capacity = ring.slots.length
  return Array.from({ length: Math.min(n, ring.size) }, (_, age) => {
    const value = ring.slots[(ring.head - 1 - age + capacity) % capacity]
    if (value === undefined) throw new Error(`Ring slot ${age} from head is empty`)
    return value
  })
}
