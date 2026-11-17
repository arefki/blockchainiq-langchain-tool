import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createBlockchainIQClient,
  DEFAULT_MAX_USD_PER_CALL,
} from "../src/client.js";

// Randomly generated test key (holds no funds; used only for offline
// EIP-3009 signing in tests). Address:
// 0x4951D99Fc8e89AdfEd249e4ef0040B48f89a7D53
const TEST_KEY =
  "0x443d606fb6f5b96fa3ee0a39c5f15b85f56349c7e26e63eb24bfd5a801491499";

describe("createBlockchainIQClient", () => {
  it("without a key: free-only client, no payment fetch", () => {
    const client = createBlockchainIQClient();
    assert.equal(client.payFetch, undefined);
    assert.equal(client.address, undefined);
    assert.equal(client.maxUsdPerCall, DEFAULT_MAX_USD_PER_CALL);
    assert.equal(DEFAULT_MAX_USD_PER_CALL, 0.05);
    assert.equal(typeof client.fetch, "function");
  });

  it("with a key: derives the wallet address and builds a payment fetch", () => {
    const client = createBlockchainIQClient({ privateKey: TEST_KEY });
    assert.equal(
      client.address,
      "0x4951D99Fc8e89AdfEd249e4ef0040B48f89a7D53",
    );
    assert.equal(typeof client.payFetch, "function");
  });

  it("respects a custom per-call cap", () => {
    const client = createBlockchainIQClient({
      privateKey: TEST_KEY,
      maxUsdPerCall: 2,
    });
    assert.equal(client.maxUsdPerCall, 2);
  });
});
