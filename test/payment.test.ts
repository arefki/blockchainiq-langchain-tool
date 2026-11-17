import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decodePaymentRequiredHeader,
  firstAccept,
  atomicToUsd,
  extractPaymentProof,
} from "../src/payment.js";

const b64 = (value: unknown) =>
  Buffer.from(JSON.stringify(value), "utf-8").toString("base64");

describe("decodePaymentRequiredHeader", () => {
  it("decodes a valid x402 v2 header", () => {
    const header = b64({
      x402Version: 2,
      resource: {
        url: "https://www.blockchainiq.co/api/x402/v1/brief",
        description: "Crypto Market Brief for Agents",
        mimeType: "application/json",
      },
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          amount: "10000",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          payTo: "0x617dA9383fbA67e86137BC4924b8b7E400fB7C9e",
          maxTimeoutSeconds: 60,
        },
      ],
    });
    const req = decodePaymentRequiredHeader(header);
    assert.equal(req.x402Version, 2);
    const accept = firstAccept(req);
    assert.equal(accept?.network, "eip155:8453");
    assert.equal(accept?.amount, "10000");
    assert.equal(atomicToUsd(accept!.amount!), 0.01);
  });

  it("rejects an empty header", () => {
    assert.throws(() => decodePaymentRequiredHeader("  "), /Empty/);
  });

  it("rejects non-JSON base64", () => {
    const header = Buffer.from("not json", "utf-8").toString("base64");
    assert.throws(() => decodePaymentRequiredHeader(header), /not valid JSON/);
  });

  it("rejects a JSON scalar", () => {
    assert.throws(() => decodePaymentRequiredHeader(b64(42)), /object/);
  });

  it("firstAccept returns undefined when no options are accepted", () => {
    assert.equal(firstAccept({ x402Version: 2, accepts: [] }), undefined);
    assert.equal(firstAccept({}), undefined);
  });
});

describe("atomicToUsd", () => {
  it("converts USDC atomic units (6 decimals) to dollars", () => {
    assert.equal(atomicToUsd("10000"), 0.01);
    assert.equal(atomicToUsd("50000"), 0.05);
    assert.equal(atomicToUsd("250000"), 0.25);
    assert.equal(atomicToUsd("2000000"), 2);
    assert.equal(atomicToUsd("0"), 0);
  });
});

describe("extractPaymentProof", () => {
  it("reads the transaction hash from the SettleResponse shape", () => {
    const proof = extractPaymentProof({
      success: true,
      transaction: "0xabc",
      network: "eip155:8453",
      payer: "0xdef",
    });
    assert.equal(proof.txHash, "0xabc");
    assert.equal(proof.payer, "0xdef");
    assert.equal(proof.network, "eip155:8453");
  });

  it("falls back to txHash / hash spellings", () => {
    assert.equal(extractPaymentProof({ txHash: "0x1" }).txHash, "0x1");
    assert.equal(extractPaymentProof({ hash: "0x2" }).txHash, "0x2");
  });

  it("keeps the raw value when nothing matches", () => {
    const proof = extractPaymentProof("weird");
    assert.equal(proof.txHash, undefined);
    assert.equal(proof.raw, "weird");
  });
});
