import { useEffect, useRef } from 'react'
import type { Severity } from '#/domain/event'
import {
  EVENT_GROUPINGS,
  GAME_SORT_OPTIONS,
  LEAGUE_FILTERS,
  parseOption,
  SEVERITIES,
  type EventGrouping,
  type FeedQuery,
  type GameSort,
  type LeagueFilter,
} from '#/feed/view'
import { useSearchPatch } from './useSearchPatch'

const LEAGUE_LABEL: Readonly<Record<LeagueFilter, string>> = {
  all: 'All leagues',
  NBA: 'NBA',
  NFL: 'NFL',
  NHL: 'NHL',
}

const SEVERITY_LABEL: Readonly<Record<Severity, string>> = {
  info: 'All events',
  notable: 'Notable and up',
  critical: 'Critical only',
}

const SORT_LABEL: Readonly<Record<GameSort, string>> = {
  schedule: 'Schedule',
  closest: 'Closest games',
  league: 'League',
}

const GROUPING_LABEL: Readonly<Record<EventGrouping, string>> = {
  none: 'No grouping',
  game: 'Game',
  league: 'League',
}

const FIELD = 'flex flex-col gap-1.5 text-xs font-medium text-slate-500'
const CONTROL =
  'h-9 w-full rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-900 transition-colors hover:border-slate-300 focus:border-sky-500 focus:bg-white focus:ring-3 focus:ring-sky-500/15 focus:outline-none'
const ICON = 'pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-slate-400'
export const BUTTON =
  'rounded border border-slate-300 px-3 py-1 font-medium text-slate-700 hover:bg-slate-100'

function Select<T extends string>({
  label,
  options,
  labels,
  value,
  onChange,
}: {
  label: string
  options: readonly T[]
  labels: Readonly<Record<T, string>>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <label className={FIELD}>
      {label}
      <span className="relative">
        <select
          className={`${CONTROL} cursor-pointer appearance-none pr-8 pl-3`}
          value={value}
          onChange={(event) => onChange(parseOption(options, event.target.value, value))}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {labels[option]}
            </option>
          ))}
        </select>
        <svg viewBox="0 0 16 16" fill="none" aria-hidden className={`${ICON} right-2.5`}>
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    </label>
  )
}

export function FeedControls({ query }: { query: FeedQuery }) {
  const update = useSearchPatch()
  const search = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const input = search.current
    if (input === null || input === document.activeElement || input.value === query.q) return
    input.value = query.q
  }, [query.q])
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-[minmax(14rem,2fr)_repeat(4,minmax(0,1fr))]">
      <label className={`${FIELD} col-span-full lg:col-span-1`}>
        Search teams
        <span className="relative">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden className={`${ICON} left-3`}>
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="m10.5 10.5 3 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            ref={search}
            type="search"
            className={`${CONTROL} pr-3 pl-9 placeholder:text-slate-400`}
            defaultValue={query.q}
            placeholder="Team name"
            onChange={(event) => update({ q: event.target.value })}
          />
        </span>
      </label>
      <Select
        label="League"
        options={LEAGUE_FILTERS}
        labels={LEAGUE_LABEL}
        value={query.league}
        onChange={(league) => update({ league })}
      />
      <Select
        label="Severity"
        options={SEVERITIES}
        labels={SEVERITY_LABEL}
        value={query.severity}
        onChange={(severity) => update({ severity })}
      />
      <Select
        label="Sort games"
        options={GAME_SORT_OPTIONS}
        labels={SORT_LABEL}
        value={query.sort}
        onChange={(sort) => update({ sort })}
      />
      <Select
        label="Group feed by"
        options={EVENT_GROUPINGS}
        labels={GROUPING_LABEL}
        value={query.group}
        onChange={(group) => update({ group })}
      />
    </div>
  )
}
