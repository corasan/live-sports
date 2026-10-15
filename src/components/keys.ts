const EDITABLE_TAGS: ReadonlySet<string> = new Set(['INPUT', 'SELECT', 'TEXTAREA'])

export function isPlainKeypress(event: KeyboardEvent): boolean {
  const { target } = event
  const typing =
    target instanceof HTMLElement && (target.isContentEditable || EDITABLE_TAGS.has(target.tagName))
  return !typing && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
}
