// index.ts
// Public surface of the attestation issuer workspace: the identity issuer
// (synthetic, no adapter), the backing issuer (real Creva signature, with
// a synthetic fallback), the Creva API connectivity check, and the offers
// port (zero adapters).

export type {
  Attestation,
  IssuedAttestation,
  IssuerFailureReason,
  IssuerOrigin,
  IssuerResult,
  JubjubPoint,
  SchnorrSignature,
  SignedPayload,
} from "./types.js";

export {
  Ed25519AttestationSigner,
  verifyAttestationSignature,
  type AttestationSigner,
} from "./signing.js";

export type { IdentityClaim, IdentityIssuerPort } from "./identity/types.js";
export { SyntheticIdentityIssuer } from "./identity/syntheticIdentityIssuer.js";

export type { CollateralClaim, BackingIssuerPort } from "./backing/types.js";
export { CrevaCollateralSigner, type CrevaSigningClient } from "./backing/crevaCollateralSigner.js";
export { SyntheticBackingIssuer } from "./backing/syntheticBackingIssuer.js";
export { CrevaAwareBackingIssuer } from "./backing/crevaAwareBackingIssuer.js";

export type { CrevaApiDegradedReason, CrevaApiPort, CrevaApiStatus } from "./crevaApi/types.js";
export { CrevaApiAdapter, type CrevaApiAdapterOptions } from "./crevaApi/crevaApiAdapter.js";

export type { OffersPort, OfferResult } from "./offers/types.js";
export { NoOffersProvider } from "./offers/noOffersProvider.js";
