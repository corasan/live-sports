export const DEFAULT_SEED = 20261014

const SEED = /^\d{1,9}$/u

export function parseSeed(raw: string): number {
  return SEED.test(raw) ? Number(raw) : DEFAULT_SEED
}
