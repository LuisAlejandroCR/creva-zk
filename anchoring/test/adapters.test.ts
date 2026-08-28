import { describe, expect, it, vi } from "vitest";
import { commitBackingOutcome } from "../src/commitment.js";
import { CardanoAnchorAdapter, type CardanoTxSubmitter } from "../src/adapters/cardano.js";
import { EvmAnchorAdapter, type EvmTxSubmitter } from "../src/adapters/evm.js";

const { commitment } = commitBackingOutcome({ tier: 2, timestamp: 1_700_000_000 });

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

  it("degrades with a fixed reason and logs the raw error separately", async () => {
    const rawError = new Error("connection refused to node at 10.0.0.4:1442");
    const submitter: CardanoTxSubmitter = {
      submitMetadata: async () => {
        throw rawError;
      },
    };
    const logError = vi.fn();
    const adapter = new CardanoAnchorAdapter(submitter, logError);

    const result = await adapter.anchor(commitment);

    expect(result).toEqual({
      status: "degraded",
      degraded: { chain: "cardano", reason: "provider_unavailable" },
    });
    expect(logError).toHaveBeenCalledWith(rawError);
  });

  it("degrades with invalid_response when the submitter returns no txHash", async () => {
    const submitter: CardanoTxSubmitter = {
      submitMetadata: async () => ({ txHash: "" }),
    };
    const adapter = new CardanoAnchorAdapter(submitter);

    const result = await adapter.anchor(commitment);

    expect(result).toEqual({
      status: "degraded",
      degraded: { chain: "cardano", reason: "invalid_response" },
    });
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

  it("degrades with a fixed reason and logs the raw error separately", async () => {
    const rawError = new Error("rpc timeout at https://internal-evm-rpc.local");
    const submitter: EvmTxSubmitter = {
      sendWithCalldata: async () => {
        throw rawError;
      },
    };
    const logError = vi.fn();
    const adapter = new EvmAnchorAdapter(submitter, logError);

    const result = await adapter.anchor(commitment);

    expect(result).toEqual({
      status: "degraded",
      degraded: { chain: "evm", reason: "provider_unavailable" },
    });
    expect(logError).toHaveBeenCalledWith(rawError);
  });

  it("degrades with a fixed reason when a non-Error is thrown", async () => {
    const submitter: EvmTxSubmitter = {
      sendWithCalldata: async () => {
        throw "rejected";
      },
    };
    const logError = vi.fn();
    const adapter = new EvmAnchorAdapter(submitter, logError);

    const result = await adapter.anchor(commitment);

    expect(result).toEqual({
      status: "degraded",
      degraded: { chain: "evm", reason: "provider_unavailable" },
    });
    expect(logError).toHaveBeenCalledWith("rejected");
  });

  it("degrades with invalid_response when the submitter returns no txHash", async () => {
    const submitter: EvmTxSubmitter = {
      sendWithCalldata: async () => ({ txHash: "" }),
    };
    const adapter = new EvmAnchorAdapter(submitter);

    const result = await adapter.anchor(commitment);

    expect(result).toEqual({
      status: "degraded",
      degraded: { chain: "evm", reason: "invalid_response" },
    });
  });
});
