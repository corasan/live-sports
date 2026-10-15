export function memoizeLast<A extends readonly unknown[], R>(
  fn: (...args: A) => R,
): (...args: A) => R {
  let last: { readonly args: A; readonly result: R } | null = null
  return (...args) => {
    const cached = last
    if (
      cached !== null &&
      cached.args.length === args.length &&
      args.every((arg, index) => sameArg(arg, cached.args[index]))
    )
      return cached.result
    const result = fn(...args)
    last = { args, result }
    return result
  }
}

function sameArg<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true
  if (!Array.isArray(a) || !Array.isArray(b)) return false
  return a.length === b.length && a.every((item, index) => Object.is(item, b[index]))
}
