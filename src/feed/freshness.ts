export const STALE_AFTER_MS = 5000

export function formatAge(ms: number): string {
  return ms < 60_000 ? `${Math.floor(ms / 1000)}s ago` : `${Math.floor(ms / 60_000)}m ago`
}
