import { useEffect, type ReactNode } from 'react'
import type { GameEvent } from '#/domain/event'
import type { Game } from '#/domain/game'
import type { EventId } from '#/domain/ids'
import { describeEvent, eventTime, SEVERITY_DOT, SEVERITY_STYLE } from './describeEvent'
import { isPlainKeypress } from './keys'
import { SELECTED_STYLE } from './styles'
import { useSelect } from './useSearchPatch'

export function MiniTimeline({
  timeline,
  focus,
  game,
  onSelect,
}: {
  timeline: readonly GameEvent[]
  focus: EventId | null
  game: Game
  onSelect: (id: EventId) => void
}) {
  if (timeline.length === 0) return null
  const first = timeline[0].ts
  const span = (timeline.at(-1)?.ts ?? first) - first
  const offset = (ts: number) => (span === 0 ? 50 : ((ts - first) / span) * 100)
  return (
    <div className="relative h-8" role="group" aria-label="Game timeline">
      <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
      {timeline.map((other) => {
        const current = other.id === focus
        const mark =
          other.kind === 'period_ended'
            ? 'h-full w-0.5 bg-slate-400'
            : `size-2.5 rounded-full ${SEVERITY_DOT[other.severity]}`
        return (
          <button
            key={other.id}
            type="button"
            aria-label={describeEvent(other, game)}
            aria-current={current || undefined}
            onClick={() => onSelect(other.id)}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer ${mark} ${current ? 'z-10 scale-150 ring-2 ring-sky-500' : ''}`}
            style={{ left: `${offset(other.ts)}%` }}
          />
        )
      })}
    </div>
  )
}

function reveal(row: HTMLElement | null) {
  row?.scrollIntoView({ block: 'nearest' })
}

export function EventList({
  events,
  focus,
  game,
  onSelect,
}: {
  events: readonly GameEvent[]
  focus: EventId | null
  game: Game
  onSelect: (id: EventId) => void
}) {
  if (events.length === 0)
    return <p className="text-sm text-slate-500">No events in this game yet</p>
  return (
    <ul className="flex max-h-[40vh] flex-col gap-1 overflow-y-auto p-0.5">
      {events.map((event) => {
        const current = event.id === focus
        return (
          <li key={event.id}>
            <button
              ref={current ? reveal : undefined}
              type="button"
              aria-current={current || undefined}
              onClick={() => onSelect(event.id)}
              className={`flex w-full cursor-pointer items-center gap-3 rounded px-3 py-2 text-left text-sm ${SEVERITY_STYLE[event.severity]} ${current ? SELECTED_STYLE : 'hover:brightness-95'}`}
            >
              <time className="text-xs text-slate-400 tabular-nums">{eventTime(event)}</time>
              <span className="min-w-0 truncate">{describeEvent(event, game)}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function DetailPanel({
  label,
  heading,
  children,
}: {
  label: string
  heading: ReactNode
  children?: ReactNode
}) {
  const select = useSelect()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !isPlainKeypress(event)) return
      event.preventDefault()
      select(undefined)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [select])

  return (
    <aside
      aria-label={label}
      className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6"
    >
      <div className="flex items-start justify-between gap-3">
        {heading}
        <button
          type="button"
          aria-label="Close details"
          onClick={() => select(undefined)}
          className="rounded px-2 text-lg leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          ×
        </button>
      </div>
      {children}
    </aside>
  )
}
