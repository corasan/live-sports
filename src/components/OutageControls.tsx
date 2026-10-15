import { useState } from 'react'
import { parseOption } from '#/feed/query'
import { BUTTON } from './styles'

const OUTAGE_DURATIONS = ['5s', '15s', '30s'] as const

type OutageDuration = (typeof OUTAGE_DURATIONS)[number]

const DURATION_MS: Readonly<Record<OutageDuration, number>> = {
  '5s': 5000,
  '15s': 15_000,
  '30s': 30_000,
}

export function OutageControls({
  outage,
  onStart,
  onEnd,
}: {
  outage: boolean
  onStart: (ms: number) => void
  onEnd: () => void
}) {
  const [duration, setDuration] = useState<OutageDuration>('5s')
  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Outage duration"
        value={duration}
        disabled={outage}
        onChange={(event) =>
          setDuration(parseOption(OUTAGE_DURATIONS, event.target.value, duration))
        }
        className="h-8 cursor-pointer rounded border border-slate-300 bg-white px-2 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {OUTAGE_DURATIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={outage ? onEnd : () => onStart(DURATION_MS[duration])}
        className={BUTTON}
      >
        {outage ? 'Reconnect now' : 'Simulate outage'}
      </button>
    </div>
  )
}
