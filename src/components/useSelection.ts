import { useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import type { EventId } from '#/domain/ids'
import type { RelatedScope } from '#/feed/view'

export type Selection = {
  readonly select: (event: EventId) => void
  readonly close: () => void
  readonly scope: (related: RelatedScope) => void
}

export function useSelection(): Selection {
  const navigate = useNavigate({ from: '/' })
  return useMemo(
    () => ({
      select: (event) =>
        navigate({ search: (previous) => ({ ...previous, event }), replace: true }),
      close: () =>
        navigate({ search: (previous) => ({ ...previous, event: undefined }), replace: true }),
      scope: (related) =>
        navigate({ search: (previous) => ({ ...previous, related }), replace: true }),
    }),
    [navigate],
  )
}
