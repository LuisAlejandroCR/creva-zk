// advisor/src/localModelPredictor.ts
// Talks to the local inference process over HTTP and validates its answer
// before trusting it. Exists so the "local, never hosted" rule is enforced in
// one place: a non-loopback endpoint is refused instead of called.

import type { AdvisorInput, Recommendation } from "./types.js";
import { isTier } from "./types.js";
import type { LocalTierPredictor } from "./localTierAdvisor.js";
import { stubPredictor } from "./stubPredictor.js";

// Config for the local model process this predictor talks to. "Local"
// means on-device/in-cluster, never a hosted third-party endpoint — the
// caller is responsible for pointing `baseUrl` at such a process only.
export interface LocalModelOptions {
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}

const DEFAULT_BASE_URL = "http://127.0.0.1:8477";
const DEFAULT_TIMEOUT_MS = 2000;

// Hostnames that count as "this machine" — the only place the "local"
// model is allowed to live. IPv6 loopback appears bracketed in a parsed
// URL's hostname (e.g. "[::1]"), so it's matched as-is.
const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set(["127.0.0.1", "[::1]", "localhost"]);

// Thrown when `baseUrl` does not resolve to a loopback hostname. Kept
// distinct from ordinary network failures so LocalTierAdvisor can surface
// it as its own typed degraded reason instead of a generic
// "model_unavailable" — a misconfigured non-local endpoint should never
// look like a normal outage, and it is never masked by falling back to
// the stub.
export class UnsafeModelEndpointError extends Error {
  constructor(baseUrl: string) {
    super(`local model endpoint must be loopback (127.0.0.1, ::1, localhost); got: ${baseUrl}`);
    this.name = "UnsafeModelEndpointError";
  }
}

function assertLoopbackEndpoint(baseUrl: string): void {
  let hostname: string;
  try {
    hostname = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    throw new UnsafeModelEndpointError(baseUrl);
  }
  if (!LOOPBACK_HOSTNAMES.has(hostname)) {
    throw new UnsafeModelEndpointError(baseUrl);
  }
}

function isRecommendationShape(value: unknown): value is Recommendation {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    isTier(candidate.tier) &&
    candidate.offerAvailable === false &&
    typeof candidate.reason === "string" &&
    candidate.reason.length > 0
  );
}

// Calls out to a local inference process over HTTP and validates the
// response before trusting it. Never reaches outside the local
// baseUrl the caller configures.
function createRemotePredictor(options: LocalModelOptions): LocalTierPredictor {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;

  return async (input: AdvisorInput) => {
    assertLoopbackEndpoint(baseUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${baseUrl}/predict`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier: input.tier } satisfies AdvisorInput),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`local model responded with status ${response.status}`);
      }

      const body: unknown = await response.json();
      if (!isRecommendationShape(body) || body.tier !== input.tier) {
        throw new Error("local model returned an unexpected shape");
      }

      return body;
    } finally {
      clearTimeout(timeout);
    }
  };
}

// The predictor wired into LocalTierAdvisor by default: tries the real
// local model first and, if it is unreachable or returns something we
// cannot trust, falls back to the deterministic stub rather than
// throwing. The one case that is never silently swapped for the stub is
// a non-loopback `baseUrl` (UnsafeModelEndpointError) — that is a
// configuration error, not an outage, so it is rethrown for
// LocalTierAdvisor to surface as its own typed degraded reason.
export function createLocalModelPredictor(options: LocalModelOptions = {}): LocalTierPredictor {
  const remotePredict = createRemotePredictor(options);

  return async (input: AdvisorInput) => {
    try {
      return await remotePredict(input);
    } catch (error) {
      if (error instanceof UnsafeModelEndpointError) {
        throw error;
      }
      return stubPredictor(input);
    }
  };
}
