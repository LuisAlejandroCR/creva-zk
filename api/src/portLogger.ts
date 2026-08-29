// api/src/portLogger.ts
// The logger shape the proof ports accept. Kept in its own file so a browser
// caller can name the type without importing a module that reaches Node —
// the real port now does, and a type-only import is the only thing that may
// cross that line. `error` is optional so a caller with no error channel
// drops the detail instead of throwing; a pino Logger satisfies both.

export interface PortLogger {
  readonly info: (obj: Record<string, unknown>, msg: string) => void;
  // Raw provider/SDK errors go here and never into an ApiResult — a degraded
  // reason is a fixed string, and an error message can carry endpoints,
  // stack fragments or container state. With pino the key is `err`.
  readonly error?: (obj: Record<string, unknown>, msg: string) => void;
}
