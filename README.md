# live-sports

A live sports scoreboard and event feed built with TanStack Start. All data comes from an in-process simulator with a seeded RNG. There is no backend, no auth, and no network data.

## Run it

Requires Node 22+ and using [Bun](https://bun.sh) 1.4+

```bash
bun install && bun dev

# Or without bun
npm install --legacy-peer-deps && npm run dev
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

- `src/domain` holds the event model and game state. `GameEvent` is a discriminated union on `kind`, and every event carries `id`, `ts`, `gameId`, and `severity`. `applyEvent` is the only way a `Game` changes.
- `src/sim` holds the simulator. `step(state, now)` is pure: it takes the previous state and a timestamp and returns the next state plus the events emitted that tick. League rules, scoring weights, and play weights live in data tables in `leagues.ts`. The slate rolls: when a game ends, the same tick emits a `game_scheduled` event for a rematch that takes its scoreboard slot, so the sim never runs dry.
- `src/feed` holds the client-side feed. `Feed` is normalized: games by id, events by id, and event ids in a ring buffer capped at 20,000. `ingest` folds a batch into games with `applyEvent` and evicts the oldest events. A retired game is dropped once its last event leaves the ring. Each simulation gets its own zustand store.
- `src/sim/pump.ts` paces the sim to a target rate. `drain(pump, rate, elapsedMs, now)` releases exactly as many events as the rate owes for the elapsed time, stepping the sim only when its pending events run out. `src/sim/useSimulation.ts` calls it every animation frame. Events are buffered for 350ms from the first one, then folded into the store on the next animation frame as one update.
- The header's stress control sets the rate from 1 to 2,000 events per second on a log scale (default 4, the sim's natural rate at one tick per second). Its readout shows measured FPS, the worst frame in the last half second, and the events per second actually ingested into the store.
- `src/sim/link.ts` sits between the pump and the store and models the transport. The header's outage control takes the link down for 5, 15, or 30 seconds, during which the client receives nothing and the feed shows a reconnecting state. The server keeps a 10 second replay window: an outage of 10 seconds or less replays every missed event in order, and a longer one resyncs the scoreboard from a snapshot and leaves a gap marker in the feed where events were lost.
- `src/components` renders the scoreboard and the event feed, reading the store with selectors. The feed is a virtualized list over the whole ring buffer with memoized rows. While you are scrolled into history, new events do not shift the rows you are reading.

# Notes

## Decisions

These are some of the decisions/notes I used to write my prompts:

- I chose Tanstack Start because of familiarity and the benefit of having fully typed routing and validated search params
- the event model os a discriminated union, each event type carries its own data. An injury type, for example, dont have points
  - batch events to apply changes in a single update, less renders per second
- Games should only change through a reducer like function, nothing in the app should change the state of a game directly.
  - The scoreboard state is derived from the events so the events and scoreboard cant differ
- A zustand store per seed for the feed. Filters and selection live in the URL. What’s on the UI is computed from both with memoized selectors
- The simulator is driven by a requestAnimationFrame loop that pushes events
  - Pausing the simulation simply stops the rAF loop
  - Rate slider changes the rate at which the rAF pushes the events
- Pausing or scroll away behavior: save the state into a local snapshot and render that state instead of the live store while the live store keeps receiving events
- Virtualize lists with Tanstack Virtual, fixed row height
- Cap events at 20k
  - downside: since the cap is at 20k, events past that number will no longer be available because it gets removed from memory. Keeps the same memory usage.
  - Ring array to keep a fixed size, overwrite oldest no matter how big the buffer is

## Trade offs

- 20k cap drops older events so we can't load older events on demand. We would use persistent data structures and be less wasteful in a real application.
- Everything runs on the main thread
- the 20k cap and the 350ms buffer is not measured, these numbers would be tuned with real profiling
- 

## AI & Tools
- I added the pstack plugin to the repo because I wanted to work as close as possible to how I would approach real work, I start my prompts with `/poteto-mode`. Pstack was overkill and the agent didn't really use the whole skillset because of how small the repo is so there was no real benefit, just showing how I use AI tools a bit more.
- Same with anti-slop oxlint rules. These are helpful to steer the agent into writing better code. I left the Effect rules in because I would normally use Effect for real work. Was overkill to use here.
- I honestly didn't really reject or change output, maybe a few small UI quirks but that's about it. Not a lot of back and forth because the prompts I wrote were clear enough. Obviously in a more complex app there would be more planning and back and forth going on to reach the desired output.

## What I'd build next
- A "watching" list
- A mobile version
- Actual persistence
