export const RATE_MIN = 1
export const RATE_MAX = 2000
export const DEFAULT_RATE = 4

const SPAN = Math.log(RATE_MAX / RATE_MIN)

export function rateAt(position: number): number {
  return RATE_MIN * Math.exp(clamp(position, 0, 1) * SPAN)
}

export function positionOf(rate: number): number {
  return Math.log(clamp(rate, RATE_MIN, RATE_MAX) / RATE_MIN) / SPAN
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
