// api/src/timeouts.ts
// The one bounded-wait helper the api workspace shares, plus every time
// budget an external step is allowed to spend before it gives up. Lifted out
// of contract.ts so the browser-direct (Lace) chain reuses the same helper
// instead of growing a second one. Imports nothing, node: included, so it
// loads in the page as readily as in the CLI.

// Distinguishable from any value the work could resolve with, which a
// timestamp or `undefined` would not be.
export const TIMED_OUT: unique symbol = Symbol("timed out");

// Bounds a wait that has no other way to end. The losing promise is left
// running — there is no cancellation to reach for here — so its eventual
// rejection is swallowed rather than left to surface as an unhandled one.
export async function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T | typeof TIMED_OUT> {
  void work.catch(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
  });
  try {
    return await Promise.race([work, expiry]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// findDeployedContract's first step is watchForDeployTxData, which waits for
// a deployment that may never appear: an address with nothing at it does not
// answer "no", it simply never answers. So the wait is bounded here. This is
// several times an indexer round trip and still far below the ~23.7s a proof
// costs, because a wrong address should fail the screen quickly.
export const DEFAULT_JOIN_TIMEOUT_MS = 20_000;

// wallet.connect() opens Lace's own dialog and does not settle until the
// user has read it and pressed Authorize or Cancel. A person reading a
// permission prompt deserves minutes, not seconds: a tighter budget would
// turn a slow but perfectly good authorization into a false failure, so this
// only catches a dialog that never appeared or a wallet that never answered.
export const DEFAULT_WALLET_CONNECT_TIMEOUT_MS = 120_000;

// getConnectionStatus, getConfiguration and getShieldedAddresses have no
// human in the loop — each is a message round trip to the extension, which
// answers in milliseconds when it is alive. Ten seconds is far more than
// that and still short enough that a wedged wallet fails the screen while
// she is still looking at it.
export const DEFAULT_WALLET_QUERY_TIMEOUT_MS = 10_000;

// A reachability probe, not a proof: this is bounded far below the ~23.7s a
// real proof costs, because a server that is not listening should fail the
// screen immediately rather than after half a minute of nothing. The proof
// itself is never bounded — see callProveBacking.
export const DEFAULT_PROOF_SERVER_PROBE_TIMEOUT_MS = 3_000;

// A deployment is the longest single wait this repository has. It is four
// things end to end, not one: building the deploy transaction, proving it on
// the local proof server (~19s measured for this circuit), Lace's own
// balance-and-sign dialog with a human reading it, and then waiting for the
// network to finalize the submitted transaction. Only the last one has no
// upper bound of its own, and none of the four can be hurried.
//
// So the budget is deliberately generous: five minutes is far longer than
// every measured part added together plus the two minutes a person is given
// to read the signing prompt, which means anything that hits it is a
// deployment that is never coming back, not a slow one. A tighter budget
// would abandon a deployment that already cost tDUST and is still on its
// way — the worst outcome this path has.
export const DEFAULT_DEPLOY_TIMEOUT_MS = 300_000;
