export type TermAlign = 'start' | 'end'

const BUBBLE_ALIGN: Readonly<Record<TermAlign, string>> = {
  start: 'left-0',
  end: 'right-0',
}

export function columnAlign(index: number, columns: number): TermAlign {
  return index === columns - 1 ? 'end' : 'start'
}

export function Term({
  id,
  label,
  hint,
  align,
  focusable,
}: {
  id: string
  label: string
  hint: string
  align: TermAlign
  focusable: boolean
}) {
  return (
    <span className="group/term relative flex min-w-0">
      <span
        tabIndex={focusable ? 0 : undefined}
        aria-describedby={id}
        className="cursor-help truncate rounded-sm underline decoration-slate-400 decoration-dotted underline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-500"
      >
        {label}
      </span>
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none invisible absolute bottom-full z-20 mb-1.5 w-56 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs leading-snug font-normal whitespace-normal text-white opacity-0 shadow-lg transition-opacity group-focus-within/term:visible group-focus-within/term:opacity-100 group-hover/term:visible group-hover/term:opacity-100 ${BUBBLE_ALIGN[align]}`}
      >
        {hint}
      </span>
    </span>
  )
}
