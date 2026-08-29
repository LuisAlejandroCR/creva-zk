// api/src/laceWallet.ts
// Wallet half of the browser-direct path: finds the Midnight wallet the
// browser injected (Lace), connects it, and turns each way that can fail
// into its own typed degraded reason — absent, locked, wrong network — so
// the screens can tell the three apart. Imports nothing from node:.

import type { Configuration, ConnectedAPI, InitialAPI } from "@midnight-ntwrk/dapp-connector-api";
import type { ApiDegraded, ApiResult } from "./types.js";

// Where a wallet installs its connector. `window` is `globalThis` in a
// browser, so this reads the same object the dapp-connector-api's own
// `Window.midnight` augmentation describes without pulling the DOM lib into
// this Node-typed workspace.
export type ConnectorHost = Record<string, InitialAPI | undefined>;

// Lace Midnight Preview (publisher IOG) is testnet-only, so the browser
// path has exactly one network to be on. The exact identifier string the
// wallet reports is a value we cannot read off a machine here, which is why
// it is an option rather than a hardcoded check — see web/README.md.
export const DEFAULT_LACE_NETWORK_ID = "testnet";

// Matched case-insensitively against InitialAPI.rdns, which is a reverse-DNS
// wallet id. A substring match, not an equality one: the exact rdns Lace
// publishes is not something this workspace can observe, and picking the
// only injected wallet is the right behaviour either way.
export const LACE_RDNS_HINT = "lace";

export interface LaceWalletOptions {
  /** The network the wallet must be on; anything else is wallet_wrong_network. */
  readonly expectedNetworkId?: string;
  /** Exact InitialAPI.rdns to select, when more than one wallet is injected. */
  readonly walletRdns?: string;
  /** Injectable for tests; defaults to the browser's own `globalThis.midnight`. */
  readonly connectorHost?: ConnectorHost;
}

export interface LaceConnection {
  readonly wallet: InitialAPI;
  readonly connected: ConnectedAPI;
  readonly configuration: Configuration;
  readonly networkId: string;
}

export function degraded<T>(step: string, reason: ApiDegraded["reason"]): ApiResult<T> {
  return { status: "degraded", degraded: { step, reason } };
}

function injectedHost(): ConnectorHost | undefined {
  const host = (globalThis as { midnight?: ConnectorHost }).midnight;
  return typeof host === "object" && host !== null ? host : undefined;
}

// Picks one injected wallet. An explicit rdns wins; otherwise the first one
// that looks like Lace; otherwise the first one at all, because a browser
// with a single Midnight wallet is the case worth working.
export function selectWallet(host: ConnectorHost, walletRdns?: string): InitialAPI | undefined {
  const wallets = Object.values(host).filter((wallet): wallet is InitialAPI => typeof wallet === "object" && wallet !== null);
  if (wallets.length === 0) return undefined;
  if (walletRdns !== undefined) {
    return wallets.find((wallet) => wallet.rdns === walletRdns);
  }
  return wallets.find((wallet) => wallet.rdns.toLowerCase().includes(LACE_RDNS_HINT)) ?? wallets[0];
}

// Connects, then checks the connection is live and on the expected network.
// Never throws: every rejection from the connector — a locked wallet, a
// declined permission prompt, an internal wallet error — comes back as a
// degraded result. The connector API has no distinct "locked" error code
// (see its ErrorCodes: Rejected, PermissionRejected, Disconnected,
// InternalError, InvalidRequest), so wallet_locked means the honest thing:
// a wallet is installed and it did not hand us a usable connection.
export async function connectLaceWallet(step: string, options: LaceWalletOptions = {}): Promise<ApiResult<LaceConnection>> {
  const host = options.connectorHost ?? injectedHost();
  if (host === undefined) {
    return degraded(step, "wallet_absent");
  }

  const wallet = selectWallet(host, options.walletRdns);
  if (wallet === undefined) {
    return degraded(step, "wallet_absent");
  }

  const expectedNetworkId = options.expectedNetworkId ?? DEFAULT_LACE_NETWORK_ID;

  let connected: ConnectedAPI;
  try {
    connected = await wallet.connect(expectedNetworkId);
  } catch {
    return degraded(step, "wallet_locked");
  }

  try {
    const status = await connected.getConnectionStatus();
    if (status.status !== "connected") {
      return degraded(step, "wallet_locked");
    }
    if (status.networkId !== expectedNetworkId) {
      return degraded(step, "wallet_wrong_network");
    }
  } catch {
    return degraded(step, "wallet_locked");
  }

  let configuration: Configuration;
  try {
    configuration = await connected.getConfiguration();
  } catch {
    return degraded(step, "wallet_locked");
  }

  // Belt and braces: a wallet that reports a connected status for one
  // network and a configuration for another is still the wrong network.
  if (configuration.networkId !== expectedNetworkId) {
    return degraded(step, "wallet_wrong_network");
  }

  return { status: "ok", value: { wallet, connected, configuration, networkId: expectedNetworkId } };
}
