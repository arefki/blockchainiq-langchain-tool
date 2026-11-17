import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createBlockchainIQTools } from "../src/tools.js";
import { PAY_TO_BASE, USDC_BASE_ADDRESS } from "../src/resources.js";

// Randomly generated test key (holds no funds; used only for offline
// EIP-3009 signing in tests). Address:
// 0x4951D99Fc8e89AdfEd249e4ef0040B48f89a7D53
const TEST_KEY =
  "0x443d606fb6f5b96fa3ee0a39c5f15b85f56349c7e26e63eb24bfd5a801491499";

const b64 = (value: unknown) =>
  Buffer.from(JSON.stringify(value), "utf-8").toString("base64");

const BRIEF_DATA = {
  prices: { btc: 100000, eth: 3000 },
  events48h: [],
  riskFlags: [],
};

function paymentRequiredHeader(amountAtomic: string) {
  return b64({
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
        amount: amountAtomic,
        asset: USDC_BASE_ADDRESS,
        payTo: PAY_TO_BASE,
        maxTimeoutSeconds: 60,
        extra: { name: "USD Coin", version: "2" },
      },
    ],
  });
}

function paymentResponseHeader(txHash: string) {
  return b64({
    success: true,
    transaction: txHash,
    network: "eip155:8453",
    payer: "0x4951D99Fc8e89AdfEd249e4ef0040B48f89a7D53",
  });
}

interface RecordedCall {
  url: string;
  hadPaymentSignature: boolean;
}

/**
 * A mock fetch that plays the server side of the x402 v2 flow:
 * unpaid request -> 402 with PAYMENT-REQUIRED; request carrying a
 * PAYMENT-SIGNATURE -> 200 with data + PAYMENT-RESPONSE.
 */
function createX402MockFetch(amountAtomic = "10000") {
  const calls: RecordedCall[] = [];
  const mockFetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const request = new Request(input, init);
    const url = request.url;
    const hadPaymentSignature =
      request.headers.has("PAYMENT-SIGNATURE") ||
      request.headers.has("X-PAYMENT");
    calls.push({ url, hadPaymentSignature });
    if (url.endsWith("/sample") || url === "https://www.blockchainiq.co/api/x402/v1") {
      return new Response(
        JSON.stringify({ data: { chain: "btc", ok: true } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (!hadPaymentSignature) {
      return new Response(JSON.stringify({ error: "payment required" }), {
        status: 402,
        headers: {
          "content-type": "application/json",
          "payment-required": paymentRequiredHeader(amountAtomic),
        },
      });
    }
    return new Response(
      JSON.stringify({ source: "Blockchain IQ", data: BRIEF_DATA }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "payment-response": paymentResponseHeader("0xmocktxhash"),
        },
      },
    );
  }) as typeof fetch;
  return { mockFetch, calls };
}

describe("blockchainiq_brief", () => {
  it("runs the full 402 -> pay -> retry flow and returns data + proof", async () => {
    const { mockFetch, calls } = createX402MockFetch("10000");
    const { brief } = createBlockchainIQTools({
      privateKey: TEST_KEY,
      fetchImpl: mockFetch,
    });
    const out = JSON.parse(await brief.invoke({}));
    assert.equal(out.resource, "brief");
    assert.equal(out.priceUsd, 0.01);
    assert.deepEqual(out.data, BRIEF_DATA);
    assert.equal(out.payment.txHash, "0xmocktxhash");
    assert.equal(out.payment.network, "eip155:8453");
    // Two requests: the unpaid 402 probe, then the paid retry.
    assert.equal(calls.length, 2);
    assert.equal(calls[0].hadPaymentSignature, false);
    assert.equal(calls[1].hadPaymentSignature, true);
    assert.ok(calls[0].url.endsWith("/api/x402/v1/brief"));
  });

  it("refuses without a wallet (no request is made)", async () => {
    const { mockFetch, calls } = createX402MockFetch();
    const { brief } = createBlockchainIQTools({ fetchImpl: mockFetch });
    await assert.rejects(() => brief.invoke({}), /needs a wallet/);
    assert.equal(calls.length, 0);
  });

  it("refuses when the price is above the configured cap", async () => {
    const { mockFetch, calls } = createX402MockFetch();
    const { brief } = createBlockchainIQTools({
      privateKey: TEST_KEY,
      maxUsdPerCall: 0.005,
      fetchImpl: mockFetch,
    });
    await assert.rejects(() => brief.invoke({}), /above the configured cap/);
    assert.equal(calls.length, 0);
  });

  it("the x402 client itself refuses a 402 above the cap", async () => {
    // Server asks $1.00; the cap is $0.05. The tool's catalogue check passes
    // (brief is $0.01) but the client's spend control must stop the payment.
    const { mockFetch, calls } = createX402MockFetch("1000000");
    const { brief } = createBlockchainIQTools({
      privateKey: TEST_KEY,
      maxUsdPerCall: 0.05,
      fetchImpl: mockFetch,
    });
    await assert.rejects(() => brief.invoke({}));
    // Only the unpaid probe went out; no paid retry was attempted.
    assert.equal(calls.length, 1);
    assert.equal(calls[0].hadPaymentSignature, false);
  });
});

describe("blockchainiq_event_risk", () => {
  it("builds the query string and pays $0.05", async () => {
    const { mockFetch, calls } = createX402MockFetch("50000");
    const { eventRisk } = createBlockchainIQTools({
      privateKey: TEST_KEY,
      fetchImpl: mockFetch,
    });
    const out = JSON.parse(
      await eventRisk.invoke({ days: 30, minImportance: 2 }),
    );
    assert.equal(out.resource, "event-risk");
    assert.equal(out.priceUsd, 0.05);
    assert.ok(calls[0].url.includes("/api/x402/v1/event-risk"));
    assert.ok(calls[0].url.includes("days=30"));
    assert.ok(calls[0].url.includes("minImportance=2"));
  });

  it("rejects out-of-range parameters", async () => {
    const { mockFetch } = createX402MockFetch();
    const { eventRisk } = createBlockchainIQTools({
      privateKey: TEST_KEY,
      fetchImpl: mockFetch,
    });
    await assert.rejects(() => eventRisk.invoke({ days: 0 }));
    await assert.rejects(() => eventRisk.invoke({ days: 91 }));
    // 4 is not a valid literal at the type level either; cast to reach runtime.
    await assert.rejects(() =>
      eventRisk.invoke({ minImportance: 4 as never }),
    );
  });
});

describe("free tools", () => {
  it("catalog and sample work with no wallet", async () => {
    const { mockFetch, calls } = createX402MockFetch();
    const { catalog, sample } = createBlockchainIQTools({
      fetchImpl: mockFetch,
    });
    const catalogOut = JSON.parse(await catalog.invoke({}));
    assert.equal(catalogOut.resource, "catalog");
    assert.equal(catalogOut.priceUsd, 0);
    const sampleOut = JSON.parse(await sample.invoke({}));
    assert.equal(sampleOut.resource, "sample");
    assert.equal(sampleOut.data.chain, "btc");
    assert.equal(calls.length, 2);
    assert.ok(calls.every((c) => !c.hadPaymentSignature));
  });
});

describe("blockchainiq_resource", () => {
  it("calls a paid resource by id with path params", async () => {
    const { mockFetch, calls } = createX402MockFetch("50000");
    const { resource } = createBlockchainIQTools({
      privateKey: TEST_KEY,
      fetchImpl: mockFetch,
    });
    const out = JSON.parse(
      await resource.invoke({ resource: "research-coin", params: { coin: "bitcoin" } }),
    );
    assert.equal(out.resource, "research-coin");
    assert.equal(out.priceUsd, 0.05);
    assert.ok(calls[0].url.endsWith("/api/x402/v1/research/bitcoin"));
  });

  it("rejects an unknown resource id", async () => {
    const { mockFetch, calls } = createX402MockFetch();
    const { resource } = createBlockchainIQTools({
      privateKey: TEST_KEY,
      fetchImpl: mockFetch,
    });
    await assert.rejects(
      () => resource.invoke({ resource: "no-such-thing" }),
      /Unknown Blockchain IQ resource/,
    );
    assert.equal(calls.length, 0);
  });

  it("refuses a resource above the cap before calling", async () => {
    const { mockFetch, calls } = createX402MockFetch();
    const { resource } = createBlockchainIQTools({
      privateKey: TEST_KEY,
      maxUsdPerCall: 0.05,
      fetchImpl: mockFetch,
    });
    await assert.rejects(
      () => resource.invoke({ resource: "analyst-pack" }),
      /above the configured cap/,
    );
    assert.equal(calls.length, 0);
  });

  it("serves free resources without a wallet", async () => {
    const { mockFetch } = createX402MockFetch();
    const { resource } = createBlockchainIQTools({ fetchImpl: mockFetch });
    const out = JSON.parse(await resource.invoke({ resource: "sample" }));
    assert.equal(out.resource, "sample");
    assert.equal(out.priceUsd, 0);
  });
});

describe("createBlockchainIQTools", () => {
  it("returns all five tools in `all`", () => {
    const tools = createBlockchainIQTools();
    assert.equal(tools.all.length, 5);
    assert.deepEqual(
      tools.all.map((t) => t.name),
      [
        "blockchainiq_brief",
        "blockchainiq_event_risk",
        "blockchainiq_catalog",
        "blockchainiq_sample",
        "blockchainiq_resource",
      ],
    );
  });
});
