import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { LiveBoard } from '#/components/LiveBoard'
import { parseEventId, type EventId } from '#/domain/ids'
import {
  DEFAULT_QUERY,
  DEFAULT_RELATED,
  parseFeedQuery,
  parseOption,
  RELATED_SCOPES,
  type FeedQuery,
  type RelatedScope,
} from '#/feed/view'
import { parseSeed } from '#/sim/seed'

export type HomeSearch = FeedQuery & {
  readonly seed: number
  readonly event?: EventId
  readonly related: RelatedScope
}

export const Route = createFileRoute('/')({
  validateSearch: (search: Partial<HomeSearch>): HomeSearch => ({
    seed: parseSeed(String(search.seed)),
    ...parseFeedQuery({
      ...Object.fromEntries(Object.entries(search).map(([key, value]) => [key, String(value)])),
      teams: search.teams,
    }),
    event: parseEventId(String(search.event)),
    related: parseOption(RELATED_SCOPES, String(search.related), DEFAULT_RELATED),
  }),
  search: { middlewares: [stripSearchParams({ ...DEFAULT_QUERY, related: DEFAULT_RELATED })] },
  component: Home,
})

function Home() {
  const { seed, event, related, ...query } = Route.useSearch()
  return <LiveBoard key={seed} seed={seed} query={query} selected={event} related={related} />
}
