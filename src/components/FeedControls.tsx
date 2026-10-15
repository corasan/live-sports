import { useEffect, useId, useRef, type ToggleEvent } from 'react'
import type { Severity } from '#/domain/event'
import { LEAGUES } from '#/domain/game'
import type { TeamId } from '#/domain/ids'
import {
  EVENT_GROUPINGS,
  GAME_SORT_OPTIONS,
  leagueSelection,
  parseOption,
  SEVERITIES,
  toggleLeague,
  toggleTeam,
  type EventGrouping,
  type FeedQuery,
  type GameSort,
} from '#/feed/view'
import { ROSTER, ROSTERS } from '#/sim/roster'
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

const FIELD = 'flex flex-col gap-1 text-xs font-medium text-slate-500'
const INPUT = 'rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900'
export const BUTTON =
  'rounded border border-slate-300 px-3 py-1 font-medium text-slate-700 hover:bg-slate-100'

const CHECKBOX = 'flex items-center gap-2 py-0.5 text-sm text-slate-900'

function selectionLabel(teams: readonly TeamId[]): string {
  if (teams.length === 0 || teams.length === ROSTER.length) return 'All teams'
  const parts = LEAGUES.flatMap((league) =>
    leagueSelection(teams, league) === 'all'
      ? [league]
      : ROSTERS[league].filter((team) => teams.includes(team.id)).map((team) => team.name),
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
        className={`${INPUT} flex w-44 items-center justify-between gap-2 text-left`}
      >
        <span className="truncate">{selectionLabel(teams)}</span>
        <span aria-hidden="true" className="text-xs text-slate-500">
          ▾
        </span>
      </button>
      <div
        id={`${id}-panel`}
        popover="auto"
        onBeforeToggle={place}
        onToggle={restoreFocus}
        className="fixed inset-auto m-0 w-60 rounded border border-slate-300 bg-white p-3 shadow-lg"
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
  const search = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const input = search.current
    if (input === null || input === document.activeElement || input.value === query.q) return
    input.value = query.q
  }, [query.q])
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className={FIELD}>
        Search teams
        <input
          ref={search}
          type="search"
          className={INPUT}
          defaultValue={query.q}
          placeholder="Team name"
          onChange={(event) => update({ q: event.target.value })}
        />
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
