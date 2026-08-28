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
// throwing. The advisor's own try/catch (for genuinely unrecoverable
// errors) and its tier validation are unaffected either way.
export function createLocalModelPredictor(options: LocalModelOptions = {}): LocalTierPredictor {
  const remotePredict = createRemotePredictor(options);

  return async (input: AdvisorInput) => {
    try {
      return await remotePredict(input);
    } catch {
      return stubPredictor(input);
    }
  };
}
