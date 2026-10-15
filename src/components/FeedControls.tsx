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

const FIELD = 'flex flex-col gap-1 text-xs font-medium text-slate-500'
const INPUT = 'rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900'
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
      <select
        className={INPUT}
        value={value}
        onChange={(event) => onChange(parseOption(options, event.target.value, value))}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
    </label>
  )
}

export function FeedControls({ query }: { query: FeedQuery }) {
  const update = useSearchPatch()
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className={FIELD}>
        Search teams
        <input
          type="search"
          className={INPUT}
          defaultValue={query.q}
          placeholder="Team name"
          onChange={(event) => update({ q: event.target.value })}
        />
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
