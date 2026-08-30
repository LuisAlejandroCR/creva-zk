// causeChain.ts
// Flattens the `cause` chain under a thrown error into console arguments.
// The SDK wraps a provider's real failure in its own error and puts the
// original on `cause`, which the console collapses — so the wrapper names the
// circuit while hiding why it failed. Both loggers print the chain instead.

// Bounded so a self-referential chain cannot spin.
export function causeChain(obj: unknown): unknown[] {
  const out: unknown[] = [];
  let current: unknown = (obj as { err?: unknown })?.err;
  for (let depth = 0; depth < 6 && current !== undefined && current !== null; depth += 1) {
    const cause = (current as { cause?: unknown }).cause;
    if (cause === undefined || cause === null) break;
    out.push(`cause[${depth}]:`, cause);
    current = cause;
  }
  return out;
}
