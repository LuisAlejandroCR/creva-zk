// api/src/proofServer.ts
// The Node-only HTTP bridge in front of the proof ports: one endpoint per
// predicate plus one that publishes this deployment's own issuer key, each
// answering with exactly the ApiResult<T> the port itself returns. Routing is
// a pure function over (method, path, body) so it is testable without opening
// a socket; startProofServer wraps it in node:http.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { ApiDegraded, ApiResult } from "./types.js";
import type { BackingProofPort, IdentityProofPort, JubjubPoint, Tier } from "./proofPort.js";

// Same shape as realProofPort's PortLogger, widened with the error level the
// server needs. Kept local for the same reason: nothing here should force a
// caller to depend on pino's types.
export interface ServerLogger {
  readonly info: (obj: Record<string, unknown>, msg: string) => void;
  readonly error: (obj: Record<string, unknown>, msg: string) => void;
}

const noopLogger: ServerLogger = { info: () => undefined, error: () => undefined };

// The issuer key of this server's own deployment. A browser cannot invent
// one: proveIdentity verifies the attestation's signature against the key it
// is handed, so a made-up key aborts the circuit and nobody decides anything.
export type IdentityIssuerKeySource = () => Promise<ApiResult<JubjubPoint>>;

export interface ProofPorts {
  readonly backing: BackingProofPort;
  readonly identity: IdentityProofPort;
  // Optional so a caller that only exercises the two predicates keeps
  // compiling; without it the issuer route degrades, which is the honest
  // answer from a server that cannot say which key it signs under.
  readonly identityIssuer?: IdentityIssuerKeySource;
}

export interface RouteResponse {
  readonly status: number;
  readonly body: string;
}

export const BACKING_ROUTE = "/proof/backing";
export const IDENTITY_ROUTE = "/proof/identity";
// Where the browser asks which key this deployment signs under, before it
// asks for a proof against that key.
export const IDENTITY_ISSUER_ROUTE = "/proof/identity/issuer";
export const DEFAULT_PROOF_SERVER_PORT = 8787;

// A proof takes ~23.7s against the local network, so the per-request budget
// has to clear that by a wide margin. Node's own default (300s) already does;
// this is set explicitly so a future edit cannot quietly drop it under a
// single proof's wall-clock time.
export const REQUEST_TIMEOUT_MS = 180_000;

// The server is a local development bridge for the Vite dev server on
// another port, so a browser reaches it cross-origin. Permissive by design:
// it exposes nothing but two predicate outcomes and a public key.
const CORS_HEADERS: Readonly<Record<string, string>> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "600",
};

function degradedBody(step: string, reason: ApiDegraded["reason"]): string {
  const result: ApiResult<never> = { status: "degraded", degraded: { step, reason } };
  return JSON.stringify(result);
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

// Accepts a decimal string (how the bridge client sends a bigint over the
// wire) or a safe integer. Anything else is a malformed request, not a
// zero-valued one.
function parseRequestedLimit(value: unknown): bigint | undefined {
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  return undefined;
}

// Both coordinates are Field elements, so they travel as decimal strings
// for the same reason requestedLimit does: JSON numbers cannot hold them.
function parseFieldElement(value: unknown): bigint | undefined {
  return typeof value === "string" && /^\d+$/.test(value) ? BigInt(value) : undefined;
}

function parseIssuerKey(value: unknown): JubjubPoint | undefined {
  const record = asRecord(value);
  const x = parseFieldElement(record?.["x"]);
  const y = parseFieldElement(record?.["y"]);
  return x === undefined || y === undefined ? undefined : { x, y };
}

// Never throws: a port that rejects (it should not — the ports return typed
// degraded results — but this is the process boundary) still becomes a
// degraded body rather than a dropped connection.
async function settle<T>(step: string, call: () => Promise<ApiResult<T>>, logger: ServerLogger): Promise<RouteResponse> {
  try {
    const result = await call();
    return { status: 200, body: JSON.stringify(result) };
  } catch (err) {
    logger.error({ err, step }, "proof port threw instead of degrading");
    return { status: 200, body: degradedBody(step, "call_failed") };
  }
}

// The key leaves as decimal strings for the same reason it arrives as them:
// a Field element does not survive JSON's number type, and JSON.stringify
// throws outright on a bigint.
async function settleIssuerKey(
  source: IdentityIssuerKeySource,
  logger: ServerLogger,
): Promise<RouteResponse> {
  try {
    const result = await source();
    if (result.status === "degraded") {
      return { status: 200, body: JSON.stringify(result) };
    }
    const wire: ApiResult<{ x: string; y: string }> = {
      status: "ok",
      value: { x: result.value.x.toString(), y: result.value.y.toString() },
    };
    return { status: 200, body: JSON.stringify(wire) };
  } catch (err) {
    logger.error({ err, step: "identityIssuerKey" }, "issuer key source threw instead of degrading");
    return { status: 200, body: degradedBody("identityIssuerKey", "call_failed") };
  }
}

export async function routeProofRequest(
  method: string | undefined,
  pathname: string,
  rawBody: string,
  ports: ProofPorts,
  logger: ServerLogger = noopLogger,
): Promise<RouteResponse> {
  const isIssuerRoute = pathname === IDENTITY_ISSUER_ROUTE;
  const isKnownRoute = pathname === BACKING_ROUTE || pathname === IDENTITY_ROUTE || isIssuerRoute;

  if (method === "OPTIONS") {
    return { status: isKnownRoute ? 204 : 404, body: "" };
  }
  if (!isKnownRoute) {
    return { status: 404, body: degradedBody("route", "call_failed") };
  }

  // The issuer key is a read, so it is a GET. A server with no deployment to
  // speak for degrades rather than inventing a key — never a 500, and never
  // a key that would abort the circuit downstream.
  if (isIssuerRoute) {
    if (method !== "GET") {
      return { status: 405, body: degradedBody("route", "call_failed") };
    }
    const source = ports.identityIssuer;
    if (source === undefined) {
      return { status: 200, body: degradedBody("identityIssuerKey", "contract_not_found") };
    }
    return await settleIssuerKey(source, logger);
  }

  if (method !== "POST") {
    return { status: 405, body: degradedBody("route", "call_failed") };
  }

  const payload = asRecord(parseJson(rawBody));
  if (payload === undefined) {
    return { status: 400, body: degradedBody(pathname === BACKING_ROUTE ? "checkBacking" : "checkIdentity", "call_failed") };
  }

  if (pathname === BACKING_ROUTE) {
    const requestedLimit = parseRequestedLimit(payload["requestedLimit"]);
    if (requestedLimit === undefined) {
      return { status: 400, body: degradedBody("checkBacking", "call_failed") };
    }
    return settle<Tier>("checkBacking", () => ports.backing.checkBacking(requestedLimit), logger);
  }

  const issuerKey = parseIssuerKey(payload["issuerKey"]);
  const expectedTaxIdHash = payload["expectedTaxIdHash"];
  if (issuerKey === undefined || typeof expectedTaxIdHash !== "string") {
    return { status: 400, body: degradedBody("checkIdentity", "call_failed") };
  }
  return settle<boolean>("checkIdentity", () => ports.identity.checkIdentity(issuerKey, expectedTaxIdHash), logger);
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function send(response: ServerResponse, route: RouteResponse): void {
  response.writeHead(route.status, { ...CORS_HEADERS, "content-type": "application/json; charset=utf-8" });
  response.end(route.body);
}

export interface RunningProofServer {
  readonly port: number;
  close(): Promise<void>;
}

// Binds the two endpoints on `port`; 0 lets the OS pick a free one, and the
// resolved handle always reports the port actually bound. Resolves once the
// socket is listening, or degrades — the caller gets a typed result, not a
// throw — if the port is already taken (which is also what a second server
// process would hit, and only one process may hold the private-state LevelDB
// lock).
export async function startProofServer(
  ports: ProofPorts,
  port: number = DEFAULT_PROOF_SERVER_PORT,
  logger: ServerLogger = noopLogger,
): Promise<ApiResult<RunningProofServer>> {
  const server: Server = createServer((request, response) => {
    void (async () => {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      const body = await readBody(request);
      const route = await routeProofRequest(request.method, pathname, body, ports, logger);
      logger.info({ method: request.method, pathname, status: route.status }, "proof request served");
      send(response, route);
    })().catch((err: unknown) => {
      logger.error({ err }, "request handler failed");
      send(response, { status: 200, body: degradedBody("request", "call_failed") });
    });
  });

  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.headersTimeout = REQUEST_TIMEOUT_MS;
  server.keepAliveTimeout = REQUEST_TIMEOUT_MS;

  return await new Promise<ApiResult<RunningProofServer>>((resolve) => {
    server.once("error", (err: unknown) => {
      logger.error({ err, port }, "proof server could not bind");
      resolve({ status: "degraded", degraded: { step: "listen", reason: "environment_unavailable" } });
    });
    server.listen(port, () => {
      const address = server.address();
      resolve({
        status: "ok",
        value: {
          port: typeof address === "object" && address !== null ? address.port : port,
          close: () => new Promise<void>((done) => server.close(() => done())),
        },
      });
    });
  });
}
