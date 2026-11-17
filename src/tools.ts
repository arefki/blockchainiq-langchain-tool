// LangChain.js tools for the Blockchain IQ x402 API.
//
// Paid tools (brief, event-risk, resource) pay in USDC on Base through the
// x402 protocol: no account, no API key — the wallet is the credential.
// Every paid call is capped twice: the tool checks the resource's catalogue
// price against `maxUsdPerCall` before calling, and the x402 client itself
// refuses any payment above that cap. Settlement is gasless for the payer.
// Free tools (catalog, sample) work with no wallet at all.

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  callFreeResource,
  callPaidResource,
  createBlockchainIQClient,
  type BlockchainIQClient,
  type BlockchainIQClientConfig,
} from "./client.js";
import {
  API_BASE,
  BASE_URL,
  RESOURCE_BY_ID,
  RESOURCES,
  buildPath,
} from "./resources.js";

export type BlockchainIQToolsConfig = BlockchainIQClientConfig;

function noWalletError(toolName: string): Error {
  return new Error(
    `Tool "${toolName}" is a paid Blockchain IQ resource and needs a wallet. ` +
      `Pass { privateKey } (a 0x key for a wallet holding USDC on Base) to ` +
      `createBlockchainIQTools. Free tools (catalog, sample) work without one.`,
  );
}

function overCapError(
  toolName: string,
  priceUsd: number,
  maxUsdPerCall: number,
): Error {
  return new Error(
    `Tool "${toolName}" costs $${priceUsd.toFixed(2)} per call, above the ` +
      `configured cap of $${maxUsdPerCall.toFixed(2)} per call. Raise ` +
      `maxUsdPerCall to use it.`,
  );
}

function formatResult(
  resource: string,
  priceUsd: number,
  result: { data: unknown; payment?: { txHash?: string; payer?: string; network?: string } },
): string {
  return JSON.stringify({
    resource,
    priceUsd,
    data: result.data,
    ...(result.payment
      ? {
          payment: {
            txHash: result.payment.txHash,
            payer: result.payment.payer,
            network: result.payment.network,
          },
        }
      : {}),
  });
}

const briefSchema = z.object({});

const eventRiskSchema = z.object({
  days: z
    .number()
    .int()
    .min(1)
    .max(90)
    .optional()
    .describe("How many days ahead to look (1-90, default 7)."),
  minImportance: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .optional()
    .describe("Minimum event importance 1-3 (default 1 = everything)."),
});

const resourceSchema = z.object({
  resource: z
    .string()
    .describe(
      `Resource id from the Blockchain IQ catalogue, e.g. "brief", "macro", "research-coin". Valid ids: ${RESOURCES.map((r) => r.id).join(", ")}.`,
    ),
  params: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      'Path parameters for the resource, e.g. {"coin": "bitcoin"} for research-coin, {"slug": "bitcoin-network"} for dashboard.',
    ),
  query: z
    .record(z.string(), z.union([z.string(), z.number()]))
    .optional()
    .describe(
      'Query parameters, e.g. {"days": 30} for event-risk or stablecoins-history.',
    ),
});

function createBriefTool(client: BlockchainIQClient) {
  return tool(
    async () => {
      if (!client.payFetch) throw noWalletError("blockchainiq_brief");
      if (client.maxUsdPerCall < 0.01) {
        throw overCapError("blockchainiq_brief", 0.01, client.maxUsdPerCall);
      }
      const result = await callPaidResource(
        client.payFetch,
        `${API_BASE}/brief`,
      );
      return formatResult("brief", 0.01, result);
    },
    {
      name: "blockchainiq_brief",
      description:
        "Crypto market brief in one parameter-free call ($0.01, paid in USDC on Base via x402): BTC, ETH, SOL and XRP prices with 24h, 7d and 30d moves and rank, scheduled macro and crypto events in the next 48 hours, and short risk flags. Use as the opening call of a trading, portfolio or research agent loop. Refreshed every minute.",
      schema: briefSchema,
    },
  );
}

function createEventRiskTool(client: BlockchainIQClient) {
  return tool(
    async ({ days = 7, minImportance = 1 }) => {
      if (!client.payFetch) throw noWalletError("blockchainiq_event_risk");
      if (client.maxUsdPerCall < 0.05) {
        throw overCapError("blockchainiq_event_risk", 0.05, client.maxUsdPerCall);
      }
      const url = new URL(`${API_BASE}/event-risk`);
      url.searchParams.set("days", String(days));
      url.searchParams.set("minImportance", String(minImportance));
      const result = await callPaidResource(client.payFetch, url.toString());
      return formatResult("event-risk", 0.05, result);
    },
    {
      name: "blockchainiq_event_risk",
      description:
        "Scheduled market-moving events for the next 7 days by default ($0.05, paid in USDC on Base via x402): US data releases with release times, FOMC, ECB and Bank of Japan decisions, Treasury auctions and dated crypto and regulatory milestones, each with importance 1-3 and official source. Use before any trade or scheduled action to know what is on the calendar.",
      schema: eventRiskSchema,
    },
  );
}

function createCatalogTool(client: BlockchainIQClient) {
  return tool(
    async () => {
      const result = await callFreeResource(client.fetch, API_BASE);
      return formatResult("catalog", 0, result);
    },
    {
      name: "blockchainiq_catalog",
      description:
        "Free catalogue of every Blockchain IQ x402 resource: id, method, path, price, title, description, what it returns, parameters and an example response. No wallet needed. Use it to discover which resource answers a question and what it costs before calling a paid tool.",
      schema: z.object({}),
    },
  );
}

function createSampleTool(client: BlockchainIQClient) {
  return tool(
    async () => {
      const result = await callFreeResource(client.fetch, `${API_BASE}/sample`);
      return formatResult("sample", 0, result);
    },
    {
      name: "blockchainiq_sample",
      description:
        "Free sample of the paid data, no wallet needed: Bitcoin network activity for its latest single day — transactions, active addresses and fees in BTC. Use to test the integration before paying.",
      schema: z.object({}),
    },
  );
}

function createResourceTool(client: BlockchainIQClient) {
  return tool(
    async ({ resource: resourceId, params = {}, query = {} }) => {
      const resource = RESOURCE_BY_ID.get(resourceId);
      if (!resource) {
        throw new Error(
          `Unknown Blockchain IQ resource "${resourceId}". Valid ids: ${RESOURCES.map((r) => r.id).join(", ")}.`,
        );
      }
      const path = buildPath(resource, params);
      const url = new URL(`${BASE_URL}${path}`);
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, String(value));
      }
      if (resource.priceUsd === 0) {
        const result = await callFreeResource(client.fetch, url.toString());
        return formatResult(resource.id, 0, result);
      }
      if (!client.payFetch) throw noWalletError("blockchainiq_resource");
      if (client.maxUsdPerCall < resource.priceUsd) {
        throw overCapError(
          "blockchainiq_resource",
          resource.priceUsd,
          client.maxUsdPerCall,
        );
      }
      const result = await callPaidResource(client.payFetch, url.toString());
      return formatResult(resource.id, resource.priceUsd, result);
    },
    {
      name: "blockchainiq_resource",
      description:
        "Call any Blockchain IQ x402 resource by id (prices $0.01-$2.00 per call, paid in USDC on Base via x402; free resources cost nothing). Use blockchainiq_catalog first to find the right resource id, its price and its parameters. The call is refused before paying if the resource price is above the configured per-call cap.",
      schema: resourceSchema,
    },
  );
}

export interface BlockchainIQTools {
  brief: ReturnType<typeof createBriefTool>;
  eventRisk: ReturnType<typeof createEventRiskTool>;
  catalog: ReturnType<typeof createCatalogTool>;
  sample: ReturnType<typeof createSampleTool>;
  resource: ReturnType<typeof createResourceTool>;
  /** All five tools, ready to hand to a LangChain agent. */
  all: [
    ReturnType<typeof createBriefTool>,
    ReturnType<typeof createEventRiskTool>,
    ReturnType<typeof createCatalogTool>,
    ReturnType<typeof createSampleTool>,
    ReturnType<typeof createResourceTool>,
  ];
  client: BlockchainIQClient;
}

/**
 * Build the Blockchain IQ LangChain tools.
 *
 * @example
 * ```ts
 * import { createBlockchainIQTools } from "blockchainiq-langchain-tool";
 *
 * const { brief, all } = createBlockchainIQTools({
 *   privateKey: process.env.AGENT_PRIVATE_KEY, // omit for free tools only
 *   maxUsdPerCall: 0.05, // default; refuses any pricier single call
 * });
 *
 * const out = await brief.invoke({});
 * ```
 */
export function createBlockchainIQTools(
  config: BlockchainIQToolsConfig = {},
): BlockchainIQTools {
  const client = createBlockchainIQClient(config);
  const brief = createBriefTool(client);
  const eventRisk = createEventRiskTool(client);
  const catalog = createCatalogTool(client);
  const sample = createSampleTool(client);
  const resource = createResourceTool(client);
  return {
    brief,
    eventRisk,
    catalog,
    sample,
    resource,
    all: [brief, eventRisk, catalog, sample, resource],
    client,
  };
}
