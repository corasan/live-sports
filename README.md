# live-sports

A live sports scoreboard and event feed built with TanStack Start. All data comes from an in-process simulator with a seeded RNG. There is no backend, no auth, and no network data.

## Run it

Requires Node 22+ and pnpm (`corepack enable` picks up the pinned version).

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. Add `?seed=<number>` to replay a specific simulation. The same seed always produces the same games and the same event sequence.

## Scripts

| Command       | What it does                                   |
| ------------- | ---------------------------------------------- |
| `pnpm dev`    | Dev server on port 3000                        |
| `pnpm test`   | Vitest suite                                   |
| `pnpm check`  | oxfmt format check, oxlint, and `tsc --noEmit` |
| `pnpm format` | Format with oxfmt                              |
| `pnpm build`  | Production build                               |

## Layout

- `src/domain` holds the event model and game state. `GameEvent` is a discriminated union on `kind`, and every event carries `id`, `ts`, `gameId`, and `severity`. `applyEvent` is the only way a `Game` changes.
- `src/sim` holds the simulator. `step(state, now)` is pure: it takes the previous state and a timestamp and returns the next state plus the events emitted that tick. League rules, scoring weights, and play weights live in data tables in `leagues.ts`.
- `src/sim/useSimulation.ts` drives `step` on a one-second interval in the browser.
- `src/components` renders the scoreboard and feed.

## Linting

oxlint runs with a vendored [anti-slop](https://github.com/dmmulroy/anti-slop) plugin in `tools/oxlint/anti-slop`. Its rules are enabled at `error` in `.oxlintrc.json`.
