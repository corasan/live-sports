import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { LiveBoard } from '#/components/LiveBoard'
import {
  DEFAULT_QUERY,
  DEFAULT_RELATED,
  parseFeedQuery,
  parseOption,
  RELATED_SCOPES,
  type FeedQuery,
  type RelatedScope,
} from '#/feed/query'
import { parseSelection, selectionSearch, type SelectionSearch } from '#/feed/selection'
import { parseSeed } from '#/sim/seed'

export type HomeSearch = FeedQuery &
  Partial<SelectionSearch> & {
    readonly seed: number
    readonly related: RelatedScope
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
      related: parseOption(RELATED_SCOPES, raw.related, DEFAULT_RELATED),
    }
  },
  search: { middlewares: [stripSearchParams({ ...DEFAULT_QUERY, related: DEFAULT_RELATED })] },
  component: Home,
})

function Home() {
  const { seed, event, game, related, ...query } = Route.useSearch()
  return (
    <LiveBoard
      key={seed}
      seed={seed}
      query={query}
      selection={parseSelection({ event, game })}
      related={related}
    />
  )
}
