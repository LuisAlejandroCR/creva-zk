// api/src/bridgeProofPort.ts
// The browser-safe implementation of both proof ports: each call is one
// fetch to the api workspace's local proof server, which holds the Node-only
// call path (and the exclusive private-state lock) the browser cannot. This
// file imports nothing from node: and nothing that reaches testcontainers,
// so it is safe to bundle into web/.

import type { ApiDegraded, ApiResult } from "./types.js";
import type { BackingProofPort, IdentityProofPort, JubjubPoint, Tier } from "./proofPort.js";

export const DEFAULT_BRIDGE_URL = "http://localhost:8787";

// A single proof measured ~23.7s (the clearing call 23697ms, the
// non-clearing one 18316ms), so anything near a 30s default would abort a
// call that was about to succeed. This budget is deliberately several times
// the measured cost, and it is a ceiling, not a wait: a server that is down
// fails immediately instead of holding the screen for two minutes.
export const DEFAULT_BRIDGE_TIMEOUT_MS = 120_000;

export interface BridgeOptions {
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  // Injectable for tests and for a host that wraps fetch; defaults to the
  // global one at call time, never at module load, so importing this file
  // in an environment without fetch is still harmless.
  readonly fetchImpl?: typeof fetch;
}

function degraded<T>(step: string, reason: ApiDegraded["reason"] = "call_failed"): ApiResult<T> {
  return { status: "degraded", degraded: { step, reason } };
}

function trimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

// Only two shapes are accepted off the wire, and both are checked
// structurally: a server answering something else — an HTML error page, a
// proxy's JSON, a half-written body — is a degraded call, not a value.
function isApiResult<T>(value: unknown, isValue: (candidate: unknown) => candidate is T): value is ApiResult<T> {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record["status"] === "ok") return isValue(record["value"]);
  if (record["status"] !== "degraded") return false;
  const inner = record["degraded"];
  if (typeof inner !== "object" || inner === null) return false;
  const degradedRecord = inner as Record<string, unknown>;
  return typeof degradedRecord["step"] === "string" && typeof degradedRecord["reason"] === "string";
}

const TIERS: readonly string[] = ["none", "bronze", "silver", "gold"];

function isTier(value: unknown): value is Tier {
  return typeof value === "string" && TIERS.includes(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

// One request, one typed outcome. Every failure mode of the trip — server
// down, DNS, CORS, non-JSON body, a body that is not an ApiResult, the
// timeout above — comes back as the same degraded result. This never throws
// and never hangs: the abort below bounds the wait unconditionally.
async function post<T>(
  step: string,
  route: string,
  payload: unknown,
  isValue: (candidate: unknown) => candidate is T,
  options: BridgeOptions,
): Promise<ApiResult<T>> {
  const doFetch = options.fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
  if (doFetch === undefined) {
    return degraded<T>(step, "environment_unavailable");
  }

  const baseUrl = trimTrailingSlash(options.baseUrl ?? DEFAULT_BRIDGE_URL);
  const timeoutMs = options.timeoutMs ?? DEFAULT_BRIDGE_TIMEOUT_MS;
  const controller = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await doFetch(`${baseUrl}${route}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    // A non-2xx answer may still carry a typed degraded body from the
    // server's own router — prefer that over inventing one, so the step the
    // server named survives the trip.
    const parsed: unknown = await response.json().catch(() => undefined);
    if (isApiResult<T>(parsed, isValue)) {
      return parsed;
    }
    return degraded<T>(step);
  } catch {
    // Includes the AbortError the timeout raises. The raw error is
    // deliberately not surfaced in the result — a degraded result carries a
    // fixed reason, never a provider's message.
    return degraded<T>(step);
  } finally {
    clearTimeout(timer);
  }
}

export function createBridgeBackingPort(options: BridgeOptions = {}): BackingProofPort {
  return {
    async checkBacking(requestedLimit: bigint): Promise<ApiResult<Tier>> {
      // Decimal string, not a number: a Uint<64> requested limit does not
      // survive JSON's number type, and JSON.stringify throws on a bigint.
      return await post<Tier>(
        "checkBacking",
        "/proof/backing",
        { requestedLimit: requestedLimit.toString() },
        isTier,
        options,
      );
    },
  };
}

export function createBridgeIdentityPort(options: BridgeOptions = {}): IdentityProofPort {
  return {
    async checkIdentity(issuerKey: JubjubPoint, expectedTaxIdHash: string): Promise<ApiResult<boolean>> {
      return await post<boolean>(
        "checkIdentity",
        "/proof/identity",
        { issuerKey: { compressed: issuerKey.compressed }, expectedTaxIdHash },
        isBoolean,
        options,
      );
    },
  };
}
