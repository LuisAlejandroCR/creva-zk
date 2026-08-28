import { describe, expect, it } from "vitest";
import { commitBackingOutcome } from "../src/commitment.js";
import { CardanoAnchorAdapter, type CardanoTxSubmitter } from "../src/adapters/cardano.js";
import { EvmAnchorAdapter, type EvmTxSubmitter } from "../src/adapters/evm.js";

const commitment = commitBackingOutcome({ tier: 2, timestamp: 1_700_000_000 });

describe("CardanoAnchorAdapter", () => {
  it("returns an anchored receipt on success", async () => {
    const submitter: CardanoTxSubmitter = {
      submitMetadata: async (metadataHex) => {
        expect(metadataHex).toEqual(commitment.hex);
        return { txHash: "cardano-tx-1" };
      },
    };
    const adapter = new CardanoAnchorAdapter(submitter);

    const result = await adapter.anchor(commitment);

    expect(result.status).toEqual("anchored");
    if (result.status === "anchored") {
      expect(result.receipt.chain).toEqual("cardano");
      expect(result.receipt.txRef).toEqual("cardano-tx-1");
      expect(result.receipt.commitment).toEqual(commitment);
    }
  });

  it("degrades instead of throwing when the provider is down", async () => {
    const submitter: CardanoTxSubmitter = {
      submitMetadata: async () => {
        throw new Error("node unreachable");
      },
    };
    const adapter = new CardanoAnchorAdapter(submitter);

    const result = await adapter.anchor(commitment);

    expect(result.status).toEqual("degraded");
    if (result.status === "degraded") {
      expect(result.degraded.chain).toEqual("cardano");
      expect(result.degraded.reason).toEqual("node unreachable");
    }
  });
});

describe("EvmAnchorAdapter", () => {
  it("returns an anchored receipt on success, 0x-prefixing the calldata", async () => {
    const submitter: EvmTxSubmitter = {
      sendWithCalldata: async (calldataHex) => {
        expect(calldataHex).toEqual(`0x${commitment.hex}`);
        return { txHash: "0xdeadbeef" };
      },
    };
    const adapter = new EvmAnchorAdapter(submitter);

    const result = await adapter.anchor(commitment);

    expect(result.status).toEqual("anchored");
    if (result.status === "anchored") {
      expect(result.receipt.chain).toEqual("evm");
      expect(result.receipt.txRef).toEqual("0xdeadbeef");
    }
  });

  it("degrades instead of throwing when the provider is down", async () => {
    const submitter: EvmTxSubmitter = {
      sendWithCalldata: async () => {
        throw new Error("rpc timeout");
      },
    };
    const adapter = new EvmAnchorAdapter(submitter);

    const result = await adapter.anchor(commitment);

    expect(result.status).toEqual("degraded");
    if (result.status === "degraded") {
      expect(result.degraded.chain).toEqual("evm");
      expect(result.degraded.reason).toEqual("rpc timeout");
    }
  });

  it("degrades with a generic reason when a non-Error is thrown", async () => {
    const submitter: EvmTxSubmitter = {
      sendWithCalldata: async () => {
        throw "rejected";
      },
    };
    const adapter = new EvmAnchorAdapter(submitter);

    const result = await adapter.anchor(commitment);

    expect(result.status).toEqual("degraded");
    if (result.status === "degraded") {
      expect(result.degraded.reason).toEqual("evm provider unavailable");
    }
  });
});
