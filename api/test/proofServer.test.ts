// api/test/proofServer.test.ts
// Checks the HTTP bridge in front of the proof ports: the router answers
// each predicate with the port's own ApiResult, rejects malformed requests
// with a typed degraded body, and — over a real socket — carries a live
// outcome all the way back into the browser-safe bridge port.

import { describe, expect, it } from "vitest";
import {
  BACKING_ROUTE,
  IDENTITY_ROUTE,
  REQUEST_TIMEOUT_MS,
  routeProofRequest,
  startProofServer,
  type ProofPorts,
} from "../src/proofServer.js";
import { createBridgeBackingPort, createBridgeIdentityPort } from "../src/bridgeProofPort.js";
import { createStubBackingPort, createStubIdentityPort } from "../src/stubProofPort.js";
import type { ApiResult } from "../src/types.js";
import type { Tier } from "../src/proofPort.js";

// Synthetic public arguments only.
const SYNTHETIC_ISSUER_KEY = { compressed: "ab".repeat(32) };
const SYNTHETIC_TAX_ID_HASH = "cd".repeat(32);

const stubPorts: ProofPorts = { backing: createStubBackingPort(), identity: createStubIdentityPort() };

// Stands in for "the proof port itself blew up" — the ports do not throw,
// but this is a process boundary and the server must hold anyway.
const throwingPorts: ProofPorts = {
  backing: { checkBacking: () => Promise.reject(new Error("proof server unreachable")) },
  identity: { checkIdentity: () => Promise.reject(new Error("proof server unreachable")) },
};

describe("routeProofRequest", () => {
  it("answers the backing endpoint with the port's own result", async () => {
    const response = await routeProofRequest("POST", BACKING_ROUTE, JSON.stringify({ requestedLimit: "3000" }), stubPorts);

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ status: "ok", value: "silver" });
  });

  it("answers the identity endpoint with the port's own result", async () => {
    const body = JSON.stringify({ issuerKey: SYNTHETIC_ISSUER_KEY, expectedTaxIdHash: SYNTHETIC_TAX_ID_HASH });

    const response = await routeProofRequest("POST", IDENTITY_ROUTE, body, stubPorts);

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ status: "ok", value: true });
  });

  it("reads a requested limit too large for a JSON number", async () => {
    const response = await routeProofRequest(
      "POST",
      BACKING_ROUTE,
      JSON.stringify({ requestedLimit: "18446744073709551615" }),
      stubPorts,
    );

    expect(JSON.parse(response.body)).toEqual({ status: "ok", value: "none" });
  });

  it("degrades on a malformed body instead of throwing", async () => {
    const response = await routeProofRequest("POST", BACKING_ROUTE, "not json", stubPorts);

    expect(response.status).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      status: "degraded",
      degraded: { step: "checkBacking", reason: "call_failed" },
    });
  });

  it("degrades on a requested limit that is not a whole number", async () => {
    const response = await routeProofRequest("POST", BACKING_ROUTE, JSON.stringify({ requestedLimit: "3e3" }), stubPorts);

    expect(response.status).toBe(400);
  });

  it("degrades on an identity request missing the issuer key", async () => {
    const response = await routeProofRequest(
      "POST",
      IDENTITY_ROUTE,
      JSON.stringify({ expectedTaxIdHash: SYNTHETIC_TAX_ID_HASH }),
      stubPorts,
    );

    expect(response.status).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      status: "degraded",
      degraded: { step: "checkIdentity", reason: "call_failed" },
    });
  });

  it("degrades on an unknown route and on the wrong method", async () => {
    expect((await routeProofRequest("POST", "/proof/whatever", "{}", stubPorts)).status).toBe(404);
    expect((await routeProofRequest("GET", BACKING_ROUTE, "", stubPorts)).status).toBe(405);
  });

  it("answers a CORS preflight so a browser on the dev server can reach it", async () => {
    expect((await routeProofRequest("OPTIONS", BACKING_ROUTE, "", stubPorts)).status).toBe(204);
  });

  it("degrades instead of throwing when a port rejects", async () => {
    const response = await routeProofRequest("POST", BACKING_ROUTE, JSON.stringify({ requestedLimit: "3000" }), throwingPorts);

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      status: "degraded",
      degraded: { step: "checkBacking", reason: "call_failed" },
    });
  });
});

describe("startProofServer", () => {
  it("does not cut a request off below a single proof's measured cost", () => {
    // Measured: 23697ms and 18316ms per call.
    expect(REQUEST_TIMEOUT_MS).toBeGreaterThan(23_697 * 2);
  });

  it("carries a live outcome from the port through HTTP into the bridge port", async () => {
    // Port 0 lets the OS pick a free one, so this never collides with a
    // server a developer already has running.
    const started = await startProofServer(stubPorts, 0);
    expect(started.status).toBe("ok");
    if (started.status !== "ok") return;

    const baseUrl = `http://127.0.0.1:${started.value.port}`;
    try {
      const backing: ApiResult<Tier> = await createBridgeBackingPort({ baseUrl }).checkBacking(3_000n);
      const identity = await createBridgeIdentityPort({ baseUrl }).checkIdentity(
        SYNTHETIC_ISSUER_KEY,
        SYNTHETIC_TAX_ID_HASH,
      );

      expect(backing).toEqual({ status: "ok", value: "silver" });
      expect(identity).toEqual({ status: "ok", value: true });
    } finally {
      await started.value.close();
    }
  });

  it("leaves the bridge port degraded — never throwing, never hanging — once it is closed", async () => {
    const started = await startProofServer(stubPorts, 0);
    expect(started.status).toBe("ok");
    if (started.status !== "ok") return;

    const baseUrl = `http://127.0.0.1:${started.value.port}`;
    await started.value.close();

    const result = await createBridgeBackingPort({ baseUrl, timeoutMs: 5_000 }).checkBacking(3_000n);

    expect(result.status).toBe("degraded");
  });
});
