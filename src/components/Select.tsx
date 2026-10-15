import { parseOption } from '#/feed/query'

export const FIELD = 'flex flex-col gap-1.5 text-xs font-medium text-slate-500'

export const CONTROL =
  'h-9 w-full rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-900 transition-colors hover:border-slate-300 focus:border-sky-500 focus:bg-white focus:ring-3 focus:ring-sky-500/15 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200'

export const ICON = 'pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-slate-400'

export function Chevron() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={`${ICON} right-2.5`}>
      <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function Select<T extends string>({
  options,
  labels,
  value,
  onChange,
  disabled,
}: {
  options: readonly T[]
  labels: Readonly<Record<T, string>>
  value: T
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <span className="relative block">
      <select
        className={`${CONTROL} cursor-pointer appearance-none pr-8 pl-3`}
        value={value}
        disabled={disabled}
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
  )
}
