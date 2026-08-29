// vitest.config.ts
// Keeps the gate honest: agent worktrees live under .claude/worktrees/ inside
// this repository, so the default scan would run every branch's tests at once
// — inflating the count and letting a stale worktree fail or mask main.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '.claude/worktrees/**',
    ],
  },
});
