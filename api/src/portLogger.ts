// api/src/portLogger.ts
// The one-method logger shape the proof ports accept. Kept in its own file
// so a browser caller can name the type without importing a module that
// reaches Node — the real port now does, and a type-only import is the only
// thing that may cross that line.

export interface PortLogger {
  readonly info: (obj: Record<string, unknown>, msg: string) => void;
}
