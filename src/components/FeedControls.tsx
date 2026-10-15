import { useEffect, useId, useRef, type ToggleEvent } from 'react'
import type { Severity } from '#/domain/event'
import { LEAGUES } from '#/domain/game'
import type { TeamId } from '#/domain/ids'
import {
  EVENT_GROUPINGS,
  GAME_SORT_OPTIONS,
  leagueSelection,
  parseOption,
  pickedTeams,
  SEVERITIES,
  toggleLeague,
  toggleTeam,
  type EventGrouping,
  type FeedQuery,
  type GameSort,
} from '#/feed/view'
import { ROSTER, ROSTERS } from '#/domain/roster'
import { useSearchPatch } from './useSearchPatch'

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

function Chevron() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={`${ICON} right-2.5`}>
      <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

const CHECKBOX = 'flex items-center gap-2 py-0.5 text-sm text-slate-900'

function selectionLabel(teams: readonly TeamId[]): string {
  if (teams.length === 0 || teams.length === ROSTER.length) return 'All teams'
  const parts = LEAGUES.flatMap((league) =>
    leagueSelection(teams, league) === 'all'
      ? [league]
      : pickedTeams(teams, league).map((team) => team.name),
  )
  return parts.length <= 2 ? parts.join(', ') : `${teams.length} teams`
}

function TeamPicker({
  teams,
  onChange,
}: {
  teams: readonly TeamId[]
  onChange: (teams: readonly TeamId[]) => void
}) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const place = (event: ToggleEvent<HTMLDivElement>) => {
    const rect = trigger.current?.getBoundingClientRect()
    if (event.newState !== 'open' || rect === undefined) return
    event.currentTarget.style.top = `${rect.bottom + 4}px`
    event.currentTarget.style.left = `${rect.left}px`
  }
  const restoreFocus = (event: ToggleEvent<HTMLDivElement>) => {
    const focused = document.activeElement
    if (
      event.newState === 'closed' &&
      (focused === document.body || event.currentTarget.contains(focused))
    )
      trigger.current?.focus()
  }
  return (
    <div className={FIELD}>
      <span id={`${id}-label`}>Teams</span>
      <button
        ref={trigger}
        id={`${id}-trigger`}
        type="button"
        popoverTarget={`${id}-panel`}
        aria-labelledby={`${id}-label ${id}-trigger`}
        className={`${CONTROL} relative cursor-pointer pr-8 pl-3 text-left`}
      >
        <span className="block truncate">{selectionLabel(teams)}</span>
        <Chevron />
      </button>
      <div
        id={`${id}-panel`}
        popover="auto"
        onBeforeToggle={place}
        onToggle={restoreFocus}
        className="fixed inset-auto m-0 w-60 rounded-md border border-slate-200 bg-white p-3 shadow-lg"
      >
        <button
          type="button"
          disabled={teams.length === 0}
          onClick={() => onChange([])}
          className="mb-2 text-sm font-medium text-sky-700 hover:underline disabled:text-slate-400 disabled:no-underline"
        >
          Show all
        </button>
        {LEAGUES.map((league) => {
          const selection = leagueSelection(teams, league)
          return (
            <fieldset key={league} className="mb-2 last:mb-0">
              <legend>
                <label className={`${CHECKBOX} font-semibold`}>
                  <input
                    type="checkbox"
                    checked={selection === 'all'}
                    ref={(input) => {
                      if (input !== null) input.indeterminate = selection === 'some'
                    }}
                    onChange={() => onChange(toggleLeague(teams, league))}
                  />
                  {league}
                </label>
              </legend>
              {ROSTERS[league].map((team) => (
                <label key={team.id} className={`${CHECKBOX} pl-5`}>
                  <input
                    type="checkbox"
                    checked={teams.includes(team.id)}
                    onChange={() => onChange(toggleTeam(teams, team.id))}
                  />
                  {team.name}
                </label>
              ))}
            </fieldset>
          )
        })}
      </div>
    </div>
  )
}

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
        <Chevron />
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      <label className={`${FIELD} col-span-full lg:col-span-2`}>
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
      <TeamPicker teams={query.teams} onChange={(teams) => update({ teams })} />
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
