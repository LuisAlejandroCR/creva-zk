// backing.test.ts
// Covers the real Creva signer (origin "creva", degrades on client
// failure), the synthetic fallback (origin "synthetic"), and
// CrevaAwareBackingIssuer routing between them based on Creva API status —
// proving the flow keeps running end to end when Creva's API is down.

import { describe, expect, it, vi } from "vitest";
import { ecMulGenerator } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import { SchnorrAttestationSigner, verifyAttestationSignature } from "../src/signing.js";
import { backingChallenge } from "./support/contractHasher.js";
import { CrevaCollateralSigner, type CrevaSigningClient } from "../src/backing/crevaCollateralSigner.js";
import { SyntheticBackingIssuer } from "../src/backing/syntheticBackingIssuer.js";
import { CrevaAwareBackingIssuer } from "../src/backing/crevaAwareBackingIssuer.js";
import type { CrevaApiPort, CrevaApiStatus } from "../src/crevaApi/types.js";
import type { JubjubPoint, SchnorrSignature } from "../src/types.js";
import type { CollateralClaim, BackingIssuerPort } from "../src/backing/types.js";

const subjectKey: JubjubPoint = ecMulGenerator(33n);
const claim: CollateralClaim = { collateral: 5_000_000n };
// A well-formed but meaningless signature: these tests cover routing and
// degradation, never signature validity, so it is never verified.
const fakeSignature: SchnorrSignature = { announcement: ecMulGenerator(44n), response: 55n };

describe("CrevaCollateralSigner", () => {
  it("issues a real attestation from Creva's signing client", async () => {
    const client: CrevaSigningClient = {
      signCollateralClaim: async (payload) => {
        expect(payload).toEqual({ subjectKey, claim });
        return { signature: fakeSignature };
      },
    };
    const signer = new CrevaCollateralSigner(client);

    const result = await signer.issue(subjectKey, claim);

    expect(result).toEqual({
      status: "issued",
      issued: { origin: "creva", attestation: { payload: { subjectKey, claim }, signature: fakeSignature } },
    });
  });

  it("degrades instead of throwing when Creva's signing client fails", async () => {
    const client: CrevaSigningClient = {
      signCollateralClaim: async () => {
        throw new Error("connection refused to signing.creva.internal");
      },
    };
    const logError = vi.fn();
    const signer = new CrevaCollateralSigner(client, logError);

    const result = await signer.issue(subjectKey, claim);

    expect(result).toEqual({ status: "degraded", reason: "signer_unavailable" });
    expect(logError).toHaveBeenCalledTimes(1);
  });
});

describe("SyntheticBackingIssuer", () => {
  it("issues an attestation tagged synthetic whose signature actually verifies", async () => {
    const signer = new SchnorrAttestationSigner(backingChallenge, 2_024n);
    const issuer = new SyntheticBackingIssuer(signer);

    const result = await issuer.issue(subjectKey, claim);

    expect(result.status).toEqual("issued");
    if (result.status === "issued") {
      expect(result.issued.origin).toEqual("synthetic");
      const { payload, signature } = result.issued.attestation;
      expect(payload).toEqual({ subjectKey, claim });
      expect(verifyAttestationSignature(backingChallenge, payload, signature, signer.publicKey)).toBe(true);
    }
  });

  it("degrades instead of throwing when the signer fails", async () => {
    const failing = {
      publicKey: ecMulGenerator(1n),
      sign: async () => {
        throw new Error("key store locked");
      },
    };
    const logError = vi.fn();
    const issuer = new SyntheticBackingIssuer(failing, logError);

    const result = await issuer.issue(subjectKey, claim);

    expect(result).toEqual({ status: "degraded", reason: "signer_unavailable" });
    expect(logError).toHaveBeenCalledTimes(1);
  });
});

describe("CrevaAwareBackingIssuer", () => {
  function makeIssuers(apiStatus: CrevaApiStatus) {
    const api: CrevaApiPort = { checkStatus: async () => apiStatus };
    const real: BackingIssuerPort = {
      issue: vi.fn(async () => ({
        status: "issued" as const,
        issued: { origin: "creva" as const, attestation: { payload: { subjectKey, claim }, signature: fakeSignature } },
      })),
    };
    const synthetic: BackingIssuerPort = {
      issue: vi.fn(async () => ({
        status: "issued" as const,
        issued: { origin: "synthetic" as const, attestation: { payload: { subjectKey, claim }, signature: fakeSignature } },
      })),
    };
    return { api, real, synthetic };
  }

  it("routes to the real Creva signer when the API is available", async () => {
    const { api, real, synthetic } = makeIssuers({ status: "available" });
    const issuer = new CrevaAwareBackingIssuer(api, real, synthetic);

    const result = await issuer.issue(subjectKey, claim);

    expect(result.status).toEqual("issued");
    if (result.status === "issued") expect(result.issued.origin).toEqual("creva");
    expect(real.issue).toHaveBeenCalledTimes(1);
    expect(synthetic.issue).not.toHaveBeenCalled();
  });

  it("falls back to the synthetic issuer, never throwing, when the API is degraded", async () => {
    const { api, real, synthetic } = makeIssuers({ status: "degraded", reason: "api_unreachable" });
    const issuer = new CrevaAwareBackingIssuer(api, real, synthetic);

    const result = await issuer.issue(subjectKey, claim);

    expect(result.status).toEqual("issued");
    if (result.status === "issued") expect(result.issued.origin).toEqual("synthetic");
    expect(synthetic.issue).toHaveBeenCalledTimes(1);
    expect(real.issue).not.toHaveBeenCalled();
  });
});
