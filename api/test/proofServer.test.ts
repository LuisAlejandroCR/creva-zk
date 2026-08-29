// api/test/proofServer.test.ts
// Checks the HTTP bridge in front of the proof ports: the router answers
// each predicate with the port's own ApiResult, rejects malformed requests
// with a typed degraded body, and — over a real socket — carries a live
// outcome all the way back into the browser-safe bridge port.

import { describe, expect, it } from "vitest";
import {
  BACKING_ROUTE,
  IDENTITY_ISSUER_ROUTE,
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

// Synthetic public arguments only. The issuer key crosses the wire as the
// (x, y) pair proveIdentity takes, with each Field element a decimal
// string for the same reason requestedLimit is one.
const SYNTHETIC_ISSUER_KEY = { x: 1n, y: 2n };
const SYNTHETIC_ISSUER_KEY_BODY = { x: "1", y: "2" };
const SYNTHETIC_TAX_ID_HASH = "cd".repeat(32);

// The (x, y) pair a deployment publishes as its own issuer key. Synthetic
// values; the shape is the one a circuit argument has to take.
const SERVER_ISSUER_KEY = { x: 77n, y: 88n };

const stubPorts: ProofPorts = {
  backing: createStubBackingPort(),
  identity: createStubIdentityPort(),
  identityIssuer: async () => ({ status: "ok", value: SERVER_ISSUER_KEY }),
};

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
    const body = JSON.stringify({ issuerKey: SYNTHETIC_ISSUER_KEY_BODY, expectedTaxIdHash: SYNTHETIC_TAX_ID_HASH });

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

// The browser cannot invent an issuer key: proveIdentity verifies the
// attestation against the key it is handed, so a made-up one aborts the
// circuit. This route is how the browser learns the right one.
describe("the identity issuer route", () => {
  it("publishes this deployment's key as decimal strings on a GET", async () => {
    const response = await routeProofRequest("GET", IDENTITY_ISSUER_ROUTE, "", stubPorts);

    expect(response.status).toBe(200);
    // Decimal strings, not numbers: a Field does not survive JSON's number
    // type, and JSON.stringify throws outright on a bigint.
    expect(JSON.parse(response.body)).toEqual({ status: "ok", value: { x: "77", y: "88" } });
  });

  it("degrades, never 500s, when the server has no deployment to speak for", async () => {
    const withoutIssuer: ProofPorts = { backing: createStubBackingPort(), identity: createStubIdentityPort() };

    const response = await routeProofRequest("GET", IDENTITY_ISSUER_ROUTE, "", withoutIssuer);

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      status: "degraded",
      degraded: { step: "identityIssuerKey", reason: "contract_not_found" },
    });
  });

  it("degrades, never 500s, when the issuer source throws", async () => {
    const exploding: ProofPorts = {
      ...stubPorts,
      identityIssuer: () => Promise.reject(new Error("no deployment")),
    };

    const response = await routeProofRequest("GET", IDENTITY_ISSUER_ROUTE, "", exploding);

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      status: "degraded",
      degraded: { step: "identityIssuerKey", reason: "call_failed" },
    });
  });

  it("passes a degraded source straight through instead of rewriting it", async () => {
    const noDeployment: ProofPorts = {
      ...stubPorts,
      identityIssuer: async () => ({
        status: "degraded",
        degraded: { step: "identityIssuerKey", reason: "environment_unavailable" },
      }),
    };

    const response = await routeProofRequest("GET", IDENTITY_ISSUER_ROUTE, "", noDeployment);

    expect(JSON.parse(response.body)).toEqual({
      status: "degraded",
      degraded: { step: "identityIssuerKey", reason: "environment_unavailable" },
    });
  });

  it("answers a preflight and refuses a POST", async () => {
    expect((await routeProofRequest("OPTIONS", IDENTITY_ISSUER_ROUTE, "", stubPorts)).status).toBe(204);
    expect((await routeProofRequest("POST", IDENTITY_ISSUER_ROUTE, "{}", stubPorts)).status).toBe(405);
  });
});
