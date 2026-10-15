import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { LiveBoard } from '#/components/LiveBoard'
import { DEFAULT_QUERY, parseFeedQuery, type FeedQuery } from '#/feed/view'
import { parseSeed } from '#/sim/seed'

type HomeSearch = FeedQuery & { readonly seed: number }

export const Route = createFileRoute('/')({
  validateSearch: (search: Partial<HomeSearch>): HomeSearch => ({
    seed: parseSeed(String(search.seed)),
    ...parseFeedQuery(
      Object.fromEntries(Object.entries(search).map(([key, value]) => [key, String(value)])),
    ),
  }),
  search: { middlewares: [stripSearchParams(DEFAULT_QUERY)] },
  component: Home,
})

function Home() {
  const { seed, ...query } = Route.useSearch()
  return <LiveBoard key={seed} seed={seed} query={query} />
}
