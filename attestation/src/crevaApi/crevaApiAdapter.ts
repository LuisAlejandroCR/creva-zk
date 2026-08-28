// crevaApiAdapter.ts
// The one place this workspace calls out to Creva's live API. Never
// throws: a down, unauthorized, or malformed-response API degrades to a
// typed result instead, so the app can still start, show why, and run the
// rest of the flow against synthetic attestations (see
// backing/crevaAwareBackingIssuer.ts).

import type { CrevaApiPort, CrevaApiStatus } from "./types.js";

export interface CrevaApiAdapterOptions {
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}

const DEFAULT_BASE_URL = "https://api.creva.example/v1";
const DEFAULT_TIMEOUT_MS = 2000;

function isHealthyBody(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  return (value as Record<string, unknown>).status === "ok";
}

export class CrevaApiAdapter implements CrevaApiPort {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: CrevaApiAdapterOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async checkStatus(): Promise<CrevaApiStatus> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/status`, { signal: controller.signal });

      if (response.status === 401 || response.status === 403) {
        return { status: "degraded", reason: "unauthorized" };
      }
      if (!response.ok) {
        return { status: "degraded", reason: "api_unreachable" };
      }

      const body: unknown = await response.json();
      if (!isHealthyBody(body)) {
        return { status: "degraded", reason: "invalid_response" };
      }

      return { status: "available" };
    } catch {
      // Network failure, timeout, or a body that is not valid JSON — all
      // the same fixed reason to the caller, since none of them is
      // something the caller can act on differently.
      return { status: "degraded", reason: "api_unreachable" };
    } finally {
      clearTimeout(timeout);
    }
  }
}
