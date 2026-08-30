// api/src/laceProviders.ts
// Provider half of the browser-direct path: the six MidnightProviders built
// entirely in the browser — IndexedDB-backed private state, the indexer the
// wallet itself points at, the user's own local proof server, and the wallet
// behind the dapp connector acting as wallet and midnight provider. Nothing
// here imports node:, and the ZK config provider fetches its artifacts over
// HTTP instead of reading them off a filesystem.

import { BrowserLevel } from "browser-level";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { levelPrivateStateProvider, type DatabaseLevel, type LevelFactory } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { parseCoinPublicKeyToHex, parseEncPublicKeyToHex, toHex } from "@midnight-ntwrk/midnight-js-utils";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import type { PortLogger } from "./portLogger.js";
import {
  createProverKey,
  createVerifierKey,
  createZKIR,
  Transaction,
  ZKConfigProvider,
  type MidnightProviders,
  type MidnightProvider,
  type ProverKey,
  type VerifierKey,
  type UnboundTransaction,
  type WalletProvider,
  type ZKIR,
} from "@midnight-ntwrk/midnight-js-types";
import type {
  CoinPublicKey,
  EncPublicKey,
  FinalizedTransaction,
  TransactionId,
} from "@midnight-ntwrk/midnight-js-protocol/ledger";
import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import type { LaceConnection } from "./laceWallet.js";
import { degraded } from "./laceWallet.js";
import { DEFAULT_WALLET_QUERY_TIMEOUT_MS, TIMED_OUT, withTimeout } from "./timeouts.js";
import type { ApiResult } from "./types.js";

// Where the compiled circuit's artifacts are served from, relative to the
// site root. The layout mirrors NodeZkConfigProvider's exactly — keys/<id>
// .prover and .verifier, zkir/<id>.bzkir — so the same compiler output can
// be copied into web/public without renaming anything.
export const DEFAULT_ZK_CONFIG_BASE_URL = "/zk";

const KEY_DIR = "keys";
const ZKIR_DIR = "zkir";
const PROVER_EXT = ".prover";
const VERIFIER_EXT = ".verifier";
const ZKIR_EXT = ".bzkir";

// Rejects anything that could climb out of the base URL. Circuit ids come
// from this repository's own contracts, but the provider is generic and a
// path segment is the one place a bad id would become a request elsewhere.
const SAFE_CIRCUIT_ID = /^[A-Za-z0-9_-]+$/;

// The browser counterpart of NodeZkConfigProvider: same file layout, fetched
// instead of read. Every failure throws, which is what ZKConfigProvider's
// contract expects — the ports above catch and degrade.
export class FetchZkConfigProvider<K extends string> extends ZKConfigProvider<K> {
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(baseUrl: string, fetchImpl: typeof fetch) {
    super();
    this.baseUrl = baseUrl;
    // Bound on the way in. The browser's fetch is a method of the global
    // object and throws "Illegal invocation" when its `this` is anything
    // else — and holding it in a field means every call site would supply
    // this provider as `this`. An injected fake is bound to itself, which
    // is what a fake expects.
    this.fetchImpl = fetchImpl.bind(globalThis);
  }

  private async fetchArtifact(subDir: string, circuitId: K, ext: string): Promise<Uint8Array> {
    if (!SAFE_CIRCUIT_ID.test(circuitId)) {
      throw new Error(`invalid circuitId: ${JSON.stringify(circuitId)}`);
    }
    const base = this.baseUrl.endsWith("/") ? this.baseUrl.slice(0, -1) : this.baseUrl;
    const response = await this.fetchImpl(`${base}/${subDir}/${circuitId}${ext}`);
    if (!response.ok) {
      throw new Error(`zk artifact ${subDir}/${circuitId}${ext} responded ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  override async getProverKey(circuitId: K): Promise<ProverKey> {
    return createProverKey(await this.fetchArtifact(KEY_DIR, circuitId, PROVER_EXT));
  }

  override async getVerifierKey(circuitId: K): Promise<VerifierKey> {
    return createVerifierKey(await this.fetchArtifact(KEY_DIR, circuitId, VERIFIER_EXT));
  }

  override async getZKIR(circuitId: K): Promise<ZKIR> {
    return createZKIR(await this.fetchArtifact(ZKIR_DIR, circuitId, ZKIR_EXT));
  }
}

// Satisfies levelPrivateStateProvider's password policy by construction:
// 31 characters, four character classes, and a separator every three
// characters so no ascending run of four can form. Generated per page load
// and never persisted — the private state store is rebuilt from the
// attestation on each run, so there is nothing here worth keeping.
export function ephemeralStoragePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length] ?? "x");
  const groups: string[] = [];
  for (let i = 0; i < chars.length; i += 3) {
    groups.push(chars.slice(i, i + 3).join(""));
  }
  // The literal tail guarantees an upper, a lower, a digit and a special
  // character regardless of what the random draw produced.
  return `${groups.join("-")}-Az9!`;
}

// BrowserLevel is IndexedDB-backed and only ever hands the store the same
// key/value formats classic-level does; its manifest type parameter is
// narrower than the alias, which is a typing detail, not a behavioural one.
function browserLevelFactory(dbName: string): DatabaseLevel {
  return new BrowserLevel<string, string>(dbName) as unknown as DatabaseLevel;
}

// Read off the connector rather than restated, so a change in the wallet
// API is a compile error here instead of a silent mismatch.
type ShieldedAddresses = Awaited<ReturnType<ConnectedAPI["getShieldedAddresses"]>>;

export interface LaceProviderOptions {
  /** Base URL the compiled circuit's prover/verifier keys and ZKIR are served from. */
  readonly zkConfigBaseUrl?: string;
  /** The local proof server to prove against; normally the one Lace reports. */
  readonly proofServerUrl: string;
  /** Injectable for tests and for a host that wraps fetch. */
  readonly fetchImpl?: typeof fetch;
  /** Injectable so a test never has to open IndexedDB. */
  readonly levelFactory?: LevelFactory;
  /** Injectable so a caller can supply a password that survives a reload. */
  readonly privateStoragePasswordProvider?: () => string | Promise<string>;
  /** How long the wallet may take to hand over its addresses. */
  readonly walletQueryTimeoutMs?: number;
  /** Raw provider errors go here, never into a degraded result. */
  readonly logger?: PortLogger;
}

// The wallet provider is the dapp connector: balancing and submission both
// happen inside Lace, which is why this path needs no key material and no
// Node process. Transactions cross that boundary hex-encoded, the encoding
// midnight-js-utils' own toHex/fromHex use.
function createLaceWalletProvider(
  connection: LaceConnection,
  coinPublicKey: CoinPublicKey,
  encryptionPublicKey: EncPublicKey,
): WalletProvider {
  return {
    async balanceTx(tx: UnboundTransaction): Promise<FinalizedTransaction> {
      const balanced = await connection.connected.balanceUnsealedTransaction(toHex(tx.serialize()));
      return Transaction.deserialize("signature", "proof", "binding", hexToBytes(balanced.tx));
    },
    getCoinPublicKey: () => coinPublicKey,
    getEncryptionPublicKey: () => encryptionPublicKey,
  };
}

// submitTransaction resolves with nothing, so the transaction identifier is
// read off the transaction that was submitted rather than invented.
function createLaceMidnightProvider(connection: LaceConnection): MidnightProvider {
  return {
    async submitTx(tx: FinalizedTransaction): Promise<TransactionId> {
      await connection.connected.submitTransaction(toHex(tx.serialize()));
      const identifier = tx.identifiers()[0];
      if (identifier === undefined) {
        throw new Error("submitted transaction carries no identifier");
      }
      return identifier;
    },
  };
}

// Local, so the chain never depends on midnight-js-utils' Buffer-returning
// fromHex just to parse a string this file produced.
function hexToBytes(hex: string): Uint8Array {
  const normalised = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (normalised.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(normalised)) {
    throw new Error("wallet returned a transaction that is not hex");
  }
  const bytes = new Uint8Array(normalised.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(normalised.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Builds all six providers from a live connection. Never throws: a wallet
// that refuses to hand over its addresses (an un-granted permission, a
// connection lost between the preflight and here) comes back as the same
// wallet_locked the preflight would have produced.
export async function createLaceProviders<CircuitId extends string, PrivateStateId extends string, PrivateState>(
  step: string,
  connection: LaceConnection,
  options: LaceProviderOptions,
): Promise<ApiResult<MidnightProviders<CircuitId, PrivateStateId, PrivateState>>> {
  const doFetch = options.fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
  if (doFetch === undefined) {
    return degraded(step, "environment_unavailable");
  }

  // The SDK keeps the network id in a module-level global, and several
  // providers read it back through getNetworkId(), which THROWS when it was
  // never set. The Node path gets it set by testkit; nothing sets it in a
  // browser, so it has to be set here — before any provider is built — or
  // the first one to look it up fails and the whole stack degrades as if the
  // wallet were locked.
  try {
    setNetworkId(connection.networkId);
  } catch (error) {
    options.logger?.error?.({ err: error, networkId: connection.networkId }, "setNetworkId refused the wallet's network id");
    return degraded(step, "wallet_wrong_network");
  }

  let coinPublicKey: CoinPublicKey;
  let encryptionPublicKey: EncPublicKey;
  let accountId: string;
  const queryBudget = options.walletQueryTimeoutMs ?? DEFAULT_WALLET_QUERY_TIMEOUT_MS;
  try {
    // Bounded like every other wallet query: a connector that answers
    // neither yes nor no is the same wallet_locked as one that refuses.
    const addressQuery: Promise<ShieldedAddresses> = connection.connected.getShieldedAddresses();
    const addresses = await withTimeout(addressQuery, queryBudget);
    if (addresses === TIMED_OUT) {
      return degraded(step, "wallet_locked");
    }
    coinPublicKey = parseCoinPublicKeyToHex(addresses.shieldedCoinPublicKey, connection.networkId);
    encryptionPublicKey = parseEncPublicKeyToHex(addresses.shieldedEncryptionPublicKey, connection.networkId);
    // Scopes the local store to this wallet. levelPrivateStateProvider hashes
    // it before it reaches a storage path, and it is a public key either way.
    accountId = addresses.shieldedCoinPublicKey;
  } catch (error) {
    // Covers both the query and the two address parses. A bech32 prefix that
    // does not match the network is a parse failure, not a locked wallet, so
    // the raw error is logged: without it this reason is unreadable.
    options.logger?.error?.({ err: error }, "could not read or parse the wallet's shielded addresses");
    return degraded(step, "wallet_locked");
  }

  const zkConfigProvider = new FetchZkConfigProvider<CircuitId>(
    options.zkConfigBaseUrl ?? DEFAULT_ZK_CONFIG_BASE_URL,
    doFetch,
  );

  // Constructing the providers is local work, but it is somebody else's
  // constructor: an indexer URI the wallet reported malformed, or an
  // IndexedDB the browser refuses to open, would throw right here. This
  // function is contracted never to throw, so it degrades instead.
  try {
    return {
      status: "ok",
      value: {
        privateStateProvider: levelPrivateStateProvider<PrivateStateId, PrivateState>({
          privateStoragePasswordProvider: options.privateStoragePasswordProvider ?? ephemeralStoragePassword,
          accountId,
          cryptoBackend: "webcrypto",
          levelFactory: options.levelFactory ?? browserLevelFactory,
        }),
        publicDataProvider: indexerPublicDataProvider(connection.configuration.indexerUri, connection.configuration.indexerWsUri),
        zkConfigProvider,
        proofProvider: httpClientProofProvider(options.proofServerUrl, zkConfigProvider),
        walletProvider: createLaceWalletProvider(connection, coinPublicKey, encryptionPublicKey),
        midnightProvider: createLaceMidnightProvider(connection),
      },
    };
  } catch (error) {
    options.logger?.error?.({ err: error }, "building the Lace providers threw");
    return degraded(step, "environment_unavailable");
  }
}
