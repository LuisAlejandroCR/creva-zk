// types.ts
// Domain types for checking whether Creva's API is reachable. Nothing here
// is specific to identity or collateral — this is the connectivity check
// the rest of the workspace reacts to.

export type CrevaApiDegradedReason = "api_unreachable" | "unauthorized" | "invalid_response";

export type CrevaApiStatus =
  | { readonly status: "available" }
  | { readonly status: "degraded"; readonly reason: CrevaApiDegradedReason };

export interface CrevaApiPort {
  checkStatus(): Promise<CrevaApiStatus>;
}
