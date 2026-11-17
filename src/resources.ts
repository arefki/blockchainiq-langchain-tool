// Resource catalogue for the Blockchain IQ x402 API (v1).
//
// Source of truth is the free catalogue at https://www.blockchainiq.co/api/x402/v1
// (and the resource list on https://www.blockchainiq.co/agents). Prices below
// were copied from those pages on 2026-11-18. The API itself is the final
// authority: every unpaid call returns HTTP 402 with the live price in the
// PAYMENT-REQUIRED header, and the x402 client's spend control refuses any
// payment above the configured cap — so a stale price here can never cause
// an overcharge, only an early (safe) refusal.
//
// `priceUsd: 0` means free (no wallet needed).

export const BASE_URL = "https://www.blockchainiq.co";
export const API_BASE = "https://www.blockchainiq.co/api/x402/v1";
export const NETWORK = "eip155:8453"; // Base
export const NETWORK_NAME = "base";
export const ASSET = "USDC";
/** USDC token contract on Base. */
export const USDC_BASE_ADDRESS =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
/** Blockchain IQ's receiving wallet on Base (from the free catalogue). */
export const PAY_TO_BASE = "0x617dA9383fbA67e86137BC4924b8b7E400fB7C9e";
export const X402_VERSION = 2;

export interface Resource {
  /** Stable id used by the generic `blockchainiq_resource` tool. */
  id: string;
  /** Path relative to the API base, with `{param}` placeholders. */
  path: string;
  /** Price in USD (0 = free). */
  priceUsd: number;
  title: string;
  description: string;
  /** Path parameters, in order. */
  params?: string[];
}

export const RESOURCES: Resource[] = [
  {
    id: "catalog",
    path: "/api/x402/v1",
    priceUsd: 0,
    title: "Catalog",
    description: "This resource list, prices, and price classes.",
  },
  {
    id: "sample",
    path: "/api/x402/v1/sample",
    priceUsd: 0,
    title: "Free sample",
    description:
      "Bitcoin network activity, unpaid — transactions, active addresses and fees for its latest single day. Use to test an integration before paying.",
  },
  {
    id: "free-dashboards",
    path: "/api/x402/v1/free/dashboards",
    priceUsd: 0,
    title: "Free dashboards",
    description: "The free Blockchain IQ analytics dashboards (US government public data and own chain reads).",
  },
  {
    id: "free-dashboard",
    path: "/api/x402/v1/free/dashboards/{slug}",
    priceUsd: 0,
    title: "Free dashboard",
    description: "Every panel of one free dashboard (e.g. cftc-positioning).",
    params: ["slug"],
  },
  {
    id: "brief",
    path: "/api/x402/v1/brief",
    priceUsd: 0.01,
    title: "Crypto Market Brief for Agents",
    description:
      "Market brief in one parameter-free call: BTC, ETH, SOL and XRP prices with 24h, 7d and 30d moves and rank, scheduled macro and crypto events in the next 48 hours, and short risk flags. Refreshed every minute.",
  },
  {
    id: "macro",
    path: "/api/x402/v1/macro",
    priceUsd: 0.05,
    title: "US macro indicators",
    description:
      "US growth, inflation, employment and interest-rate indicators from FRED and other official sources, plus WTI crude oil, gold and silver prices.",
  },
  {
    id: "calendar",
    path: "/api/x402/v1/calendar",
    priceUsd: 0.03,
    title: "Economic and crypto calendar",
    description:
      "The next 90 days of market-moving events: US data releases with times, FOMC, ECB and Bank of Japan rate decisions, US Treasury coupon auctions, and curated crypto and regulatory milestones.",
  },
  {
    id: "indices",
    path: "/api/x402/v1/indices",
    priceUsd: 0.03,
    title: "Indices list",
    description: "Every Blockchain IQ curated index, with its coin count.",
  },
  {
    id: "dashboard",
    path: "/api/x402/v1/dashboards/{slug}",
    priceUsd: 0.25,
    title: "Analytics dashboard",
    description:
      "One dashboard, every panel. 14 blockchain network dashboards ($0.25), defi-lending-rates ($0.10) or lending-liquidation-risk ($0.05). Price is the maximum for the resource; the 402 names the exact price.",
    params: ["slug"],
  },
  {
    id: "dashboard-panel",
    path: "/api/x402/v1/dashboards/{slug}/{panel}",
    priceUsd: 0.03,
    title: "Analytics chart",
    description:
      "One chart from a blockchain network dashboard, with the analyst's read of it. The price panel is not sold (404, no payment asked).",
    params: ["slug", "panel"],
  },
  {
    id: "dashboard-section",
    path: "/api/x402/v1/sections/{section}",
    priceUsd: 0.5,
    title: "Analytics section bundle",
    description:
      "Every blockchain network dashboard sold through the API in a single call (section 'networks', 14 chains).",
    params: ["section"],
  },
  {
    id: "event-risk",
    path: "/api/x402/v1/event-risk",
    priceUsd: 0.05,
    title: "Event Risk - Next 7 Days",
    description:
      "Scheduled market-moving events for the next 7 days by default (?days= up to 90): US data releases, FOMC/ECB/BoJ decisions, Treasury auctions and dated crypto and regulatory milestones, each with importance 1-3 and official source.",
  },
  {
    id: "network",
    path: "/api/x402/v1/network/{chain}",
    priceUsd: 0.03,
    title: "Blockchain Network Activity",
    description:
      "One blockchain's activity in one call: latest weekly transactions, active addresses or senders, fees, blocks, value moved and new accounts with 7-day change, ranked tables and an analyst's read per metric. Any of 14 chains by slug or symbol.",
    params: ["chain"],
  },
  {
    id: "networks",
    path: "/api/x402/v1/networks",
    priceUsd: 0.1,
    title: "All 14 Chains Activity Snapshot",
    description:
      "Parameter-free: the activity snapshot for all 14 blockchains in one call, each with latest weekly metrics, 7-day change and analyst reads.",
  },
  {
    id: "stablecoins",
    path: "/api/x402/v1/stablecoins",
    priceUsd: 0.02,
    title: "USDC & EURC Supply and Control",
    description:
      "Circle USDC and EURC snapshot on Ethereum, Base and Arbitrum from the token contracts: total supply, supply change, net issuance split, mint/burn counts, paused flag, role holders, blacklist count.",
  },
  {
    id: "stablecoins-events",
    path: "/api/x402/v1/stablecoins/events",
    priceUsd: 0.02,
    title: "USDC & EURC Blacklist Events",
    description:
      "Circle USDC and EURC control events on Ethereum, Base and Arbitrum, newest first: blacklistings and reversals, pauses, minter allowances, role changes and proxy upgrades.",
  },
  {
    id: "stablecoins-history",
    path: "/api/x402/v1/stablecoins/history",
    priceUsd: 0.02,
    title: "USDC & EURC Issuance History",
    description:
      "Daily Circle USDC or EURC history for one chain (Ethereum, Base, Arbitrum), up to 365 days: end-of-day supply, mints, burns, net issuance split, control events and blacklist changes.",
  },
  {
    id: "x402-market",
    path: "/api/x402/v1/x402-market",
    priceUsd: 0.02,
    title: "x402 Seller Conformance Roster",
    description:
      "The Blockchain IQ x402 Conformance Index in one call: the top 1,000 x402 sellers ranked by an A to F grade from a daily unpaid probe of their listed endpoints.",
  },
  {
    id: "x402-seller-history",
    path: "/api/x402/v1/x402-seller-history",
    priceUsd: 0.05,
    title: "x402 Seller Conformance History",
    description:
      "One x402 seller wallet's daily record in the Conformance Index, up to 90 days. Pass payTo (required), optional network and days.",
  },
  {
    id: "analyst-pack",
    path: "/api/x402/v1/analyst-pack",
    priceUsd: 2.0,
    title: "BIQ Analyst Daily Pack",
    description:
      "One parameter-free daily pack: about 100 coins ranked by total score 0-100 with tier and eight component scores, the analyst's macro regime rating and notes, and market gates as pass, watch or block.",
  },
  {
    id: "reports-digest",
    path: "/api/x402/v1/reports/digest",
    priceUsd: 0.5,
    title: "Crypto Research Reports - Digest",
    description: "Every Blockchain IQ research report sold here in one parameter-free call.",
  },
  {
    id: "ripple-review",
    path: "/api/x402/v1/reports/the-ripple-review",
    priceUsd: 0.1,
    title: "The Ripple Review - XRP Daily",
    description:
      "The Ripple Review, parameter-free: Blockchain IQ's daily XRP and XRP Ledger report, newest edition.",
  },
  {
    id: "liquidation-levels",
    path: "/api/x402/v1/reports/liquidation-levels",
    priceUsd: 0.1,
    title: "Coinbase Loan Liquidation Levels",
    description:
      "Where collateral behind Coinbase's BTC, ETH and XRP loans becomes liquidatable, summed by price across every borrower, from the newest daily run.",
  },
  {
    id: "research-digest",
    path: "/api/x402/v1/research/digest",
    priceUsd: 0.5,
    title: "Crypto Research - All 21 Chains",
    description:
      "Blockchain IQ research on all 21 tracked blockchains in one parameter-free call.",
  },
  {
    id: "research-coin",
    path: "/api/x402/v1/research/{coin}",
    priceUsd: 0.05,
    title: "Crypto Coin Research Brief",
    description:
      "One coin's full Blockchain IQ research brief by research slug or CoinGecko id (130+ coins). Full text as Markdown plus structured sections.",
    params: ["coin"],
  },
  {
    id: "dispatch-bis",
    path: "/api/x402/v1/dispatch/bis-digital-money-research-review",
    priceUsd: 0.02,
    title: "BIS Crypto & CBDC Research",
    description:
      "What the Bank for International Settlements says crypto, stablecoins and CBDCs must do: a review of 1,553 BIS papers and eight years of annual reports.",
  },
  {
    id: "dispatch-occ",
    path: "/api/x402/v1/dispatch/occ-bank-charter-race",
    priceUsd: 0.02,
    title: "Crypto Bank Charter Race (OCC)",
    description:
      "How more than a dozen crypto and crypto-adjacent firms applied to the OCC for federal bank charters since 2024 and the GENIUS Act, and where the applications stand.",
  },
  {
    id: "dispatch-sec-v-ripple",
    path: "/api/x402/v1/dispatch/sec-v-ripple",
    priceUsd: 0.02,
    title: "SEC v. Ripple - Case History",
    description:
      "SEC v. Ripple, the case that redrew the line between a coin and a security: four and a half years from the complaint to the appellate mandate.",
  },
  {
    id: "dispatch-governance",
    path: "/api/x402/v1/dispatch/blockchain-governance-models",
    priceUsd: 0.02,
    title: "Blockchain Governance Guide",
    description:
      "A field guide to the six governance models actually in use across crypto, what each optimizes for, where each has broken, and which chains use which.",
  },
  {
    id: "dispatch-ondo-blackrock",
    path: "/api/x402/v1/dispatch/ondo-blackrock-intelligent-portfolios",
    priceUsd: 0.02,
    title: "BlackRock Portfolios on Ondo",
    description:
      "BlackRock puts three model portfolios on Ondo: what is actually on-chain and what is not in the three tokens that wrap BlackRock-designed strategies.",
  },
  {
    id: "glossary",
    path: "/api/x402/v1/glossary",
    priceUsd: 0.05,
    title: "Crypto Glossary - 350+ Terms",
    description:
      "The whole Blockchain IQ crypto glossary in one parameter-free call: 350+ terms across DeFi, trading, blockchains, stablecoins, regulation and macro.",
  },
];

export const RESOURCE_BY_ID = new Map(RESOURCES.map((r) => [r.id, r]));

/** Fill `{param}` placeholders in a resource path. Throws on a missing param. */
export function buildPath(
  resource: Resource,
  params: Record<string, string> = {},
): string {
  let path = resource.path;
  for (const name of resource.params ?? []) {
    const value = params[name];
    if (!value) {
      throw new Error(
        `Resource "${resource.id}" needs path parameter "${name}".`,
      );
    }
    path = path.replace(`{${name}}`, encodeURIComponent(value));
  }
  return path;
}

/** Find a known resource whose path pattern matches an absolute API path. */
export function matchResource(apiPath: string): Resource | undefined {
  const clean = apiPath.split("?")[0];
  return RESOURCES.find((r) => {
    const pattern =
      "^" + r.path.replace(/\{[^}]+\}/g, "[^/]+") + "$";
    return new RegExp(pattern).test(clean);
  });
}
