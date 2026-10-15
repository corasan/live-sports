import type { FeedStore } from '#/feed/store'
import { positionOf, rateAt } from '#/sim/rate'
import { useFrameStats } from './useFrameStats'

const SLIDER_STEP = 0.001

function Stat({ label, value, width }: { label: string; value: string; width: string }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className={`${width} text-right font-semibold text-slate-900 tabular-nums`}>
        {value}
      </span>
      {label}
    </span>
  )
}

export function StressControls({
  store,
  rate,
  onRateChange,
}: {
  store: FeedStore
  rate: number
  onRateChange: (rate: number) => void
}) {
  const { fps, worstFrameMs, ingestedPerSecond } = useFrameStats(store)
  return (
    <div className="flex items-center gap-4">
      <label className="flex items-center gap-2">
        <span>Rate</span>
        <input
          type="range"
          min={0}
          max={1}
          step={SLIDER_STEP}
          value={positionOf(rate)}
          onChange={(event) => onRateChange(rateAt(Number(event.target.value)))}
          className="w-32 accent-slate-900"
        />
        <span className="w-[9ch] text-right tabular-nums">{Math.round(rate)} ev/s</span>
      </label>
      <output className="flex gap-3" aria-live="off">
        <Stat label="fps" value={fps.toFixed(0)} width="w-[3ch]" />
        <Stat label="ms worst" value={worstFrameMs.toFixed(0)} width="w-[4ch]" />
        <Stat label="ev/s in" value={ingestedPerSecond.toFixed(0)} width="w-[4ch]" />
      </output>
    </div>
  )
}
