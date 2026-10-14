import { createFileRoute } from '@tanstack/react-router'
import { LiveBoard } from '#/components/LiveBoard'
import { parseSeed } from '#/sim/seed'

export const Route = createFileRoute('/')({
  validateSearch: (search) => ({ seed: parseSeed(String(search.seed)) }),
  component: Home,
})

function Home() {
  const { seed } = Route.useSearch()
  return <LiveBoard key={seed} seed={seed} />
}
