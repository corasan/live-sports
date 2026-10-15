import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import type { FeedQuery } from '#/feed/query'
import { useSearchPatch } from './useSearchPatch'

export function useDeferredSearch(query: FeedQuery) {
  const update = useSearchPatch()
  const [draft, setDraft] = useState<string | null>(null)
  if (draft === query.q) setDraft(null)
  const text = draft ?? query.q
  const q = useDeferredValue(text)
  useEffect(() => {
    if (q === draft) update({ q })
  }, [q, draft, update])
  const visible = useMemo(() => ({ ...query, q }), [query, q])
  return { visible, text, onSearch: setDraft }
}
