import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { LiveBoard } from '#/components/LiveBoard'
import { DEFAULT_QUERY, parseFeedQuery, type FeedQuery } from '#/feed/query'
import { parseSelection, selectionSearch, type SelectionSearch } from '#/feed/selection'
import { parseSeed } from '#/sim/seed'

export type HomeSearch = FeedQuery &
  Partial<SelectionSearch> & {
    readonly seed: number
  }

export const Route = createFileRoute('/')({
  validateSearch: (search: Partial<HomeSearch>): HomeSearch => {
    const raw = Object.fromEntries(
      Object.entries(search)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)]),
    )
    return {
      seed: parseSeed(raw.seed ?? ''),
      ...parseFeedQuery({ ...raw, teams: search.teams }),
      ...selectionSearch(parseSelection(raw)),
    }
  },
  search: { middlewares: [stripSearchParams(DEFAULT_QUERY)] },
  component: Home,
})

function Home() {
  const { seed, event, game, ...query } = Route.useSearch()
  return (
    <LiveBoard key={seed} seed={seed} query={query} selection={parseSelection({ event, game })} />
  )
}
