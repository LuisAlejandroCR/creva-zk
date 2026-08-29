// identity.test.ts
// SyntheticIdentityIssuer is the sole implementation of IdentityIssuerPort:
// checks it issues a real, verifiable signature tagged "synthetic", and
// degrades instead of throwing when the signer fails.

import { describe, expect, it, vi } from "vitest";
import { SyntheticIdentityIssuer } from "../src/identity/syntheticIdentityIssuer.js";
import { ecMulGenerator } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import { SchnorrAttestationSigner, verifyAttestationSignature } from "../src/signing.js";
import type { AttestationSigner } from "../src/signing.js";
import type { JubjubPoint } from "../src/types.js";
import type { IdentityClaim } from "../src/identity/types.js";
import { identityChallenge } from "./support/contractHasher.js";

const subjectKey: JubjubPoint = ecMulGenerator(11n);
const claim: IdentityClaim = { verified: true, ofAge: true, taxId: "22".repeat(32) };

describe("SyntheticIdentityIssuer", () => {
  it("issues an attestation tagged synthetic that verifies against the signer's key", async () => {
    const signer = new SchnorrAttestationSigner(identityChallenge, 1_111n);
    const issuer = new SyntheticIdentityIssuer(signer);

    const result = await issuer.issue(subjectKey, claim);

    expect(result.status).toEqual("issued");
    if (result.status === "issued") {
      expect(result.issued.origin).toEqual("synthetic");
      const { payload, signature } = result.issued.attestation;
      expect(payload).toEqual({ subjectKey, claim });
      expect(verifyAttestationSignature(identityChallenge, payload, signature, signer.publicKey)).toBe(true);
    }
  });

  it("degrades instead of throwing when the signer fails", async () => {
    const failingSigner: AttestationSigner<IdentityClaim> = {
      publicKey: ecMulGenerator(1n),
      sign: async () => {
        throw new Error("key store locked");
      },
    };
    const logError = vi.fn();
    const issuer = new SyntheticIdentityIssuer(failingSigner, logError);

    const result = await issuer.issue(subjectKey, claim);

    expect(result).toEqual({ status: "degraded", reason: "signer_unavailable" });
    expect(logError).toHaveBeenCalledTimes(1);
  });
});
