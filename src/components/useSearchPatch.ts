import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { selectionSearch, type Selection } from '#/feed/view'
import type { HomeSearch } from '#/routes/index'

export function useSearchPatch(): (patch: Partial<HomeSearch>) => void {
  const navigate = useNavigate({ from: '/' })
  return useCallback(
    (patch: Partial<HomeSearch>) =>
      void navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true }),
    [navigate],
  )
}

export function useSelect(): (selection: Selection | undefined) => void {
  const patch = useSearchPatch()
  return useCallback((selection) => patch(selectionSearch(selection)), [patch])
}
