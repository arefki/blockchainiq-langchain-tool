import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  API_BASE,
  RESOURCES,
  RESOURCE_BY_ID,
  buildPath,
  matchResource,
} from "../src/resources.js";

describe("resource catalogue", () => {
  it("lists brief at $0.01 (the bounty test call)", () => {
    const brief = RESOURCE_BY_ID.get("brief");
    assert.ok(brief);
    assert.equal(brief.priceUsd, 0.01);
    assert.equal(brief.path, "/api/x402/v1/brief");
  });

  it("lists event-risk at $0.05 (the other qualifying resource)", () => {
    const eventRisk = RESOURCE_BY_ID.get("event-risk");
    assert.ok(eventRisk);
    assert.equal(eventRisk.priceUsd, 0.05);
  });

  it("every path lives under the API base", () => {
    for (const resource of RESOURCES) {
      assert.ok(
        resource.path.startsWith("/api/x402/v1"),
        `${resource.id}: ${resource.path}`,
      );
      assert.ok(resource.priceUsd >= 0, `${resource.id}: negative price`);
    }
  });

  it("has unique ids", () => {
    const ids = RESOURCES.map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("the free resources cost $0", () => {
    for (const id of ["catalog", "sample", "free-dashboards"]) {
      assert.equal(RESOURCE_BY_ID.get(id)?.priceUsd, 0, id);
    }
  });
});

describe("buildPath", () => {
  it("fills path parameters", () => {
    const coin = RESOURCE_BY_ID.get("research-coin")!;
    assert.equal(
      buildPath(coin, { coin: "bitcoin" }),
      "/api/x402/v1/research/bitcoin",
    );
    const panel = RESOURCE_BY_ID.get("dashboard-panel")!;
    assert.equal(
      buildPath(panel, { slug: "bitcoin-network", panel: "active-addresses" }),
      "/api/x402/v1/dashboards/bitcoin-network/active-addresses",
    );
  });

  it("throws on a missing path parameter", () => {
    const coin = RESOURCE_BY_ID.get("research-coin")!;
    assert.throws(() => buildPath(coin, {}), /needs path parameter "coin"/);
  });

  it("URL-encodes parameter values", () => {
    const coin = RESOURCE_BY_ID.get("research-coin")!;
    assert.equal(
      buildPath(coin, { coin: "a/b" }),
      "/api/x402/v1/research/a%2Fb",
    );
  });
});

describe("matchResource", () => {
  it("matches concrete paths to their resource", () => {
    assert.equal(matchResource("/api/x402/v1/brief")?.id, "brief");
    assert.equal(
      matchResource("/api/x402/v1/research/bitcoin")?.id,
      "research-coin",
    );
    assert.equal(
      matchResource("/api/x402/v1/dashboards/bitcoin-network/active-addresses")
        ?.id,
      "dashboard-panel",
    );
  });

  it("ignores query strings and returns undefined for unknown paths", () => {
    assert.equal(matchResource("/api/x402/v1/event-risk?days=7")?.id, "event-risk");
    assert.equal(matchResource("/api/x402/v1/nope"), undefined);
  });
});

describe("API_BASE", () => {
  it("points at the Blockchain IQ x402 v1 API", () => {
    assert.equal(API_BASE, "https://www.blockchainiq.co/api/x402/v1");
  });
});
