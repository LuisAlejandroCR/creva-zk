// crevaApi.test.ts
// CrevaApiAdapter never throws: every failure mode (unreachable,
// unauthorized, malformed body) resolves to a typed degraded result, and a
// healthy response resolves to "available".

import { describe, expect, it } from "vitest";
import { CrevaApiAdapter } from "../src/crevaApi/crevaApiAdapter.js";

function fakeFetch(handler: (input: string | URL | Request, init?: RequestInit) => Promise<Response>): typeof fetch {
  return handler as unknown as typeof fetch;
}

describe("CrevaApiAdapter", () => {
  it("reports available on a healthy response", async () => {
    const adapter = new CrevaApiAdapter({
      fetchImpl: fakeFetch(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
    });

    expect(await adapter.checkStatus()).toEqual({ status: "available" });
  });

  it("reports api_unreachable when the network call rejects", async () => {
    const adapter = new CrevaApiAdapter({
      fetchImpl: fakeFetch(async () => {
        throw new Error("connect ECONNREFUSED api.creva.example:443");
      }),
    });

    expect(await adapter.checkStatus()).toEqual({ status: "degraded", reason: "api_unreachable" });
  });

  it("reports api_unreachable on a non-ok status", async () => {
    const adapter = new CrevaApiAdapter({
      fetchImpl: fakeFetch(async () => new Response("", { status: 503 })),
    });

    expect(await adapter.checkStatus()).toEqual({ status: "degraded", reason: "api_unreachable" });
  });

  it("reports unauthorized on a 401", async () => {
    const adapter = new CrevaApiAdapter({
      fetchImpl: fakeFetch(async () => new Response("", { status: 401 })),
    });

    expect(await adapter.checkStatus()).toEqual({ status: "degraded", reason: "unauthorized" });
  });

  it("reports invalid_response when the body doesn't match the expected shape", async () => {
    const adapter = new CrevaApiAdapter({
      fetchImpl: fakeFetch(async () => new Response(JSON.stringify({ unexpected: true }), { status: 200 })),
    });

    expect(await adapter.checkStatus()).toEqual({ status: "degraded", reason: "invalid_response" });
  });
});
