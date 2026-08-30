// nodeGlobals.ts
// Supplies the one Node global Midnight's SDK reaches for in a browser.
// midnight-js-utils decodes bech32 addresses through Buffer, which no browser
// defines, so parsing the wallet's own address threw ReferenceError and the
// whole Lace stack degraded as if the wallet were locked.

import { Buffer } from 'buffer';

// Assigned, never replaced: a host that already provides one (a test runner,
// a future browser) keeps its own. This module has to be imported before any
// SDK code runs, which is why main.ts imports it first and the Lace chunk is
// only ever reached through a later dynamic import.
declare global {
  // eslint-disable-next-line no-var
  var Buffer: typeof import('buffer').Buffer;
}

if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}

export {};
