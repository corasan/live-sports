# live-sports

A live sports scoreboard and event feed built with TanStack Start. All data comes from an in-process simulator with a seeded RNG. There is no backend, no auth, and no network data.

## Run it

Requires [Bun](https://bun.sh) 1.4+ and Node 22+ (Vite and Vitest run on Node).

```bash
bun install
bun dev
```

Open http://localhost:3000. Add `?seed=<number>` to replay a specific simulation. The same seed always produces the same games and the same event sequence.

## Scripts

| Command          | What it does                                                  |
| ---------------- | ------------------------------------------------------------- |
| `bun run dev`    | Dev server on port 3000                                       |
| `bun run test`   | Vitest suite (plain `bun test` runs Bun's own runner instead) |
| `bun run check`  | oxfmt format check, oxlint, and `tsc --noEmit`                |
| `bun run format` | Format with oxfmt                                             |
| `bun run build`  | Production build                                              |

## Layout

- `src/domain` holds the event model and game state. `GameEvent` is a discriminated union on `kind`, and every event carries `id`, `ts`, `gameId`, a `reason` (its severity is derived from it with `severityOf`), and `before`, the game's status and score just before the event. `applyEvent` is the only way a `Game` changes.
- `src/sim` holds the simulator. `step(state, now)` is pure: it takes the previous state and a timestamp and returns the next state plus the events emitted that tick. League rules, scoring weights, and play weights live in data tables in `leagues.ts`. The slate rolls: when a game ends, the same tick emits a `game_scheduled` event for a rematch that takes its scoreboard slot, so the sim never runs dry.
- `src/feed` holds the client-side feed. `Feed` is normalized: games by id, events by id, and event ids in a ring buffer capped at 20,000. `ingest` folds a batch into games with `applyEvent` and evicts the oldest events. A retired game is dropped once its last event leaves the ring. Each simulation gets its own zustand store.
- `src/sim/pump.ts` paces the sim to a target rate. `drain(pump, rate, elapsedMs, now)` releases exactly as many events as the rate owes for the elapsed time, stepping the sim only when its pending events run out. `src/sim/useSimulation.ts` calls it every animation frame. Events are buffered for 350ms from the first one, then folded into the store on the next animation frame as one update.
- The header's stress control sets the rate from 1 to 2,000 events per second on a log scale (default 4, the sim's natural rate at one tick per second). Its readout shows measured FPS, the worst frame in the last half second, and the events per second actually ingested into the store.
- `src/sim/link.ts` sits between the pump and the store and models the transport. The header's outage control takes the link down for 5, 15, or 30 seconds, during which the client receives nothing and the feed shows a reconnecting state. The server keeps a 10 second replay window: an outage of 10 seconds or less replays every missed event in order, and a longer one resyncs the scoreboard from a snapshot and leaves a gap marker in the feed where events were lost.
- `src/components` renders the scoreboard and the event feed, reading the store with selectors. The feed is a virtualized list over the whole ring buffer with memoized rows. While you are scrolled into history, new events do not shift the rows you are reading.

## Linting

oxlint runs with a vendored [anti-slop](https://github.com/dmmulroy/anti-slop) plugin in `tools/oxlint/anti-slop`. Its rules are enabled at `error` in `.oxlintrc.json`.
