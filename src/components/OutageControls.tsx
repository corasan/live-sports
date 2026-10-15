import { useState } from 'react'
import { Select } from './Select'
import { BUTTON } from './styles'

const OUTAGE_DURATIONS = ['5s', '15s', '30s'] as const

type OutageDuration = (typeof OUTAGE_DURATIONS)[number]

const DURATION_MS: Readonly<Record<OutageDuration, number>> = {
  '5s': 5000,
  '15s': 15_000,
  '30s': 30_000,
}

const DURATION_LABEL: Readonly<Record<OutageDuration, string>> = {
  '5s': '5 seconds',
  '15s': '15 seconds',
  '30s': '30 seconds',
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
      <label className="flex items-center gap-2">
        <span>Outage</span>
        <Select
          options={OUTAGE_DURATIONS}
          labels={DURATION_LABEL}
          value={duration}
          disabled={outage}
          onChange={setDuration}
        />
      </label>
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
