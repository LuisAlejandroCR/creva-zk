// api/test/bridgeProofPort.test.ts
// Checks the never-throw, never-hang contract of the browser-safe bridge
// port against a stubbed fetch: a live outcome comes through typed, and
// every way the trip can fail — server down, non-2xx, junk body, wrong
// value shape, timeout — settles as a degraded result instead.

import { describe, expect, it, vi } from "vitest";
import {
  createBridgeBackingPort,
  createBridgeIdentityPort,
  fetchIdentityIssuerKey,
  DEFAULT_BRIDGE_TIMEOUT_MS,
  DEFAULT_BRIDGE_URL,
} from "../src/bridgeProofPort.js";
import type { JubjubPoint } from "../src/proofPort.js";

// Synthetic public arguments only — no real issuer key, no real tax ID.
const SYNTHETIC_ISSUER_KEY: JubjubPoint = { x: 1n, y: 2n };
const SYNTHETIC_TAX_ID_HASH = "cd".repeat(32);

// What a server publishes for its own deployment. Deliberately different
// from the caller's key above: the whole point is that only this one is right.
const SERVER_ISSUER_KEY = { x: "77", y: "88" };

// An identity check is two trips: ask which key this deployment signs under,
// then prove against it. This answers both, in order.
function identityFetch(proofBody: unknown, issuerBody: unknown = { status: "ok", value: SERVER_ISSUER_KEY }) {
  return vi.fn(async (url: string) =>
    String(url).endsWith("/proof/identity/issuer")
      ? jsonResponse(200, issuerBody)
      : jsonResponse(200, proofBody),
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function fetchReturning(response: Response | (() => Promise<Response>)): typeof fetch {
  return vi.fn(async () => (typeof response === "function" ? await response() : response)) as unknown as typeof fetch;
}

describe("createBridgeBackingPort", () => {
  it("returns the tier the server answered with", async () => {
    const fetchImpl = fetchReturning(jsonResponse(200, { status: "ok", value: "silver" }));
    const port = createBridgeBackingPort({ fetchImpl });

    const result = await port.checkBacking(3_000n);

    expect(result).toEqual({ status: "ok", value: "silver" });
  });

  it("posts the requested limit as a decimal string to the backing endpoint", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { status: "ok", value: "none" }));
    const port = createBridgeBackingPort({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await port.checkBacking(18_446_744_073_709_551_615n);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${DEFAULT_BRIDGE_URL}/proof/backing`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ requestedLimit: "18446744073709551615" });
  });

  it("degrades instead of throwing when the server is down", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const port = createBridgeBackingPort({ fetchImpl });

    const result = await port.checkBacking(3_000n);

    expect(result.status).toBe("degraded");
    if (result.status === "degraded") {
      expect(result.degraded).toEqual({ step: "checkBacking", reason: "call_failed" });
    }
  });

  it("passes through the typed degraded result a non-2xx answer carries", async () => {
    const fetchImpl = fetchReturning(
      jsonResponse(400, { status: "degraded", degraded: { step: "checkBacking", reason: "call_failed" } }),
    );
    const port = createBridgeBackingPort({ fetchImpl });

    const result = await port.checkBacking(3_000n);

    expect(result.status).toBe("degraded");
  });

  it("degrades when the body is not JSON at all", async () => {
    const fetchImpl = fetchReturning(new Response("<html>502 Bad Gateway</html>", { status: 502 }));
    const port = createBridgeBackingPort({ fetchImpl });

    expect((await port.checkBacking(3_000n)).status).toBe("degraded");
  });

  it("degrades when the answer is JSON but not an ApiResult", async () => {
    const fetchImpl = fetchReturning(jsonResponse(200, { tier: "gold" }));
    const port = createBridgeBackingPort({ fetchImpl });

    expect((await port.checkBacking(3_000n)).status).toBe("degraded");
  });

  it("degrades when the ok value is not a tier this port knows", async () => {
    const fetchImpl = fetchReturning(jsonResponse(200, { status: "ok", value: "platinum" }));
    const port = createBridgeBackingPort({ fetchImpl });

    expect((await port.checkBacking(3_000n)).status).toBe("degraded");
  });

  it("degrades rather than hanging when the server never answers", async () => {
    // Never resolves on its own; only the port's own abort ends this call.
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    ) as unknown as typeof fetch;
    const port = createBridgeBackingPort({ fetchImpl, timeoutMs: 10 });

    const result = await port.checkBacking(3_000n);

    expect(result.status).toBe("degraded");
  });

  it("does not time out below a single proof's measured cost", async () => {
    // The measured calls were 23697ms (clearing) and 18316ms (non-clearing),
    // so a 30s default would abort a call that was about to succeed.
    expect(DEFAULT_BRIDGE_TIMEOUT_MS).toBeGreaterThan(23_697 * 2);
  });
});

describe("createBridgeIdentityPort", () => {
  it("returns the boolean the server answered with", async () => {
    const fetchImpl = identityFetch({ status: "ok", value: true });
    const port = createBridgeIdentityPort({ fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(await port.checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH)).toEqual({ status: "ok", value: true });
  });

  it("asks for the server's own issuer key first, and only then proves", async () => {
    const fetchImpl = identityFetch({ status: "ok", value: false });
    const port = createBridgeIdentityPort({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      baseUrl: "http://localhost:9999/",
    });

    await port.checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH);

    expect(fetchImpl.mock.calls.length).toBe(2);
    const [issuerUrl, issuerInit] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(issuerUrl).toBe("http://localhost:9999/proof/identity/issuer");
    expect(issuerInit.method).toBe("GET");
    expect(issuerInit.body).toBeUndefined();
  });

  it("proves against the server's key, never the one the caller passed", async () => {
    const fetchImpl = identityFetch({ status: "ok", value: false });
    const port = createBridgeIdentityPort({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await port.checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH);

    const [url, init] = fetchImpl.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe(`${DEFAULT_BRIDGE_URL}/proof/identity`);
    expect(JSON.parse(String(init.body))).toEqual({
      issuerKey: SERVER_ISSUER_KEY,
      expectedTaxIdHash: SYNTHETIC_TAX_ID_HASH,
    });
    // The caller's key is the one that made the circuit abort. It must not
    // appear on the wire at all.
    expect(String(init.body)).not.toContain(`"${SYNTHETIC_ISSUER_KEY.x.toString()}"`);
  });

  // The loop's own verifier.
  it("never attempts the proof when the issuer key did not come back", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const port = createBridgeIdentityPort({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await port.checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH);

    expect(fetchImpl.mock.calls.length).toBe(1);
    expect(result.status).toBe("degraded");
  });

  it("degrades instead of throwing when the server is down", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const port = createBridgeIdentityPort({ fetchImpl });

    const result = await port.checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH);

    expect(result.status).toBe("degraded");
    if (result.status === "degraded") {
      // The step names the trip that failed: nobody could even ask which key
      // to prove against, so the proof was never attempted.
      expect(result.degraded).toEqual({ step: "identityIssuerKey", reason: "call_failed" });
    }
  });

  it("passes the server's own degraded reason through instead of inventing one", async () => {
    const fetchImpl = identityFetch(
      { status: "ok", value: true },
      { status: "degraded", degraded: { step: "identityIssuerKey", reason: "contract_not_found" } },
    );
    const port = createBridgeIdentityPort({ fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(await port.checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH)).toEqual({
      status: "degraded",
      degraded: { step: "identityIssuerKey", reason: "contract_not_found" },
    });
  });

  it("degrades when the ok value is not a boolean", async () => {
    const fetchImpl = identityFetch({ status: "ok", value: "true" });
    const port = createBridgeIdentityPort({ fetchImpl: fetchImpl as unknown as typeof fetch });

    expect((await port.checkIdentity(SYNTHETIC_ISSUER_KEY, SYNTHETIC_TAX_ID_HASH)).status).toBe("degraded");
  });
});

describe("fetchIdentityIssuerKey", () => {
  it("reads the (x, y) pair back as the bigints a circuit argument needs", async () => {
    const fetchImpl = fetchReturning(jsonResponse(200, { status: "ok", value: SERVER_ISSUER_KEY }));

    await expect(fetchIdentityIssuerKey({ fetchImpl })).resolves.toEqual({
      status: "ok",
      value: { x: 77n, y: 88n },
    });
  });

  it("degrades rather than accepting a key that is not two decimal fields", async () => {
    for (const value of [{ compressed: "ab" }, { x: "0xff", y: "2" }, { x: 1, y: 2 }, { x: "1" }]) {
      const fetchImpl = fetchReturning(jsonResponse(200, { status: "ok", value }));

      expect((await fetchIdentityIssuerKey({ fetchImpl })).status).toBe("degraded");
    }
  });

  it("degrades instead of throwing when the server is down", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    await expect(fetchIdentityIssuerKey({ fetchImpl })).resolves.toEqual({
      status: "degraded",
      degraded: { step: "identityIssuerKey", reason: "call_failed" },
    });
  });
});

describe("bridge module imports", () => {
  it("imports nothing from node: and nothing that reaches testcontainers", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("../src/bridgeProofPort.ts", import.meta.url), "utf8");

    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);

    expect(imports.length).toBeGreaterThan(0);
    for (const specifier of imports) {
      expect(specifier?.startsWith("node:")).toBe(false);
      expect(specifier?.startsWith(".")).toBe(true);
    }
  });
});
