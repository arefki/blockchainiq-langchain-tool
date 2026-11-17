# Blockchain IQ tools for LangChain.js

LangChain.js tools for the [Blockchain IQ](https://www.blockchainiq.co/agents) x402 pay-per-call crypto data API: 27 resources (market brief, macro indicators, economic calendar, chain dashboards, research reports and more), priced $0.01–$2.00 per call, paid in USDC on Base. **No account, no API key** — a wallet holding USDC is the only credential.

Built for the [Blockchain IQ x402 build bounties](https://www.blockchainiq.co/blog/x402-build-bounties) (LangChain slot).

## Install

```bash
npm install blockchainiq-langchain-tool
```

Node 18 or later.

## Quick start

```ts
import { createBlockchainIQTools } from "blockchainiq-langchain-tool";

const { brief, eventRisk, catalog, sample, resource, all } =
  createBlockchainIQTools({
    privateKey: process.env.AGENT_PRIVATE_KEY, // omit for free tools only
    maxUsdPerCall: 0.05, // default; refuses any pricier single call
  });

// The $0.01 market brief — the cheapest call, and the bounty test call.
const out = JSON.parse(await brief.invoke({}));
console.log(out.data); // BTC/ETH/SOL/XRP prices, 48h events, risk flags
console.log(out.payment.txHash); // settlement proof (Base tx hash)

// Hand all five tools to an agent.
import { createAgent } from "langchain";
const agent = createAgent({ model, tools: all });
```

## Tools

| Tool | Price | What it returns |
| --- | --- | --- |
| `blockchainiq_brief` | $0.01 | Market brief: BTC, ETH, SOL, XRP prices with 24h/7d/30d moves, events in the next 48h, risk flags. Refreshed every minute. |
| `blockchainiq_event_risk` | $0.05 | Scheduled market-moving events (`days` 1–90, `minImportance` 1–3). |
| `blockchainiq_catalog` | free | Every resource: id, path, price, parameters, example response. No wallet needed. |
| `blockchainiq_sample` | free | Bitcoin network activity for the latest day. No wallet needed. |
| `blockchainiq_resource` | $0.01–$2.00 | Any catalogue resource by id (macro, calendar, dashboards, research, …). |

Every paid tool returns `{ resource, priceUsd, data, payment: { txHash, payer, network } }` — the settlement proof is part of the result, so an agent (or a bounty claim) can cite the transaction.

## How payment works

The API speaks x402 protocol v2:

1. The tool makes a plain GET. The unpaid request returns **HTTP 402** with a `PAYMENT-REQUIRED` header: base64 JSON naming the price, the asset (USDC), the network (`eip155:8453`, Base) and the address to pay.
2. The bundled x402 client (`@x402/fetch` + `@x402/evm`) signs a USDC payment (EIP-3009) and retries with it.
3. The API returns **HTTP 200** with JSON, plus a `PAYMENT-RESPONSE` header carrying the settlement transaction hash.

**Settlement is gasless for the payer** — the facilitator submits the transaction, so the only cost of a call is its listed price. A 404 or an error response is never charged.

## Spend controls

Every paid call is capped twice:

- The tool checks the resource's catalogue price against `maxUsdPerCall` **before** calling, and refuses with a clear error if it is above the cap.
- The x402 client itself refuses any payment above `maxUsdPerCall`, so even a price change on the server side cannot cause an overcharge.

The default cap is **$0.05**, which covers `brief` ($0.01) and `event-risk` ($0.05). Raise it only as far as you need — the dearest resource (the analyst pack) is $2.00.

Use a **dedicated wallet with a small balance**, never a main wallet.

## Examples

```bash
# Direct $0.01 brief call, no LLM (needs AGENT_PRIVATE_KEY).
npm run example:brief

# Full agent with all five tools (needs AGENT_PRIVATE_KEY + OPENAI_API_KEY).
npm run example:agent
```

## Test call (bounty check)

`scripts/test-call.ts` performs the $0.01 `brief` call through the LangChain tool and writes the settlement proof to `test-call-proof.json`.

```bash
# Dry run first: validates everything except the payment. Costs nothing.
npm run test:call:dry

# Live run: spends $0.01 USDC on Base (gasless).
AGENT_PRIVATE_KEY=0x... npm run test:call -- --live
```

The dry run fetches the free catalogue (confirms `brief` is $0.01), fetches the free sample, makes an **unpaid** call to `/brief` and verifies the 402 names $0.01 USDC on Base to Blockchain IQ's address, and — if a key is set — checks the wallet's USDC balance on Base (read-only).

## Development

```bash
npm install
npm test        # typecheck + build + unit tests (node:test, mocked x402 flow)
npm run build   # tsc -> dist/
```

The unit tests mock the HTTP layer and run the full 402 → sign → retry flow offline (EIP-3009 signing is local), so they verify the payment path without spending anything.

## Links

- API catalogue (free): https://www.blockchainiq.co/api/x402/v1
- How a call works: https://www.blockchainiq.co/blog/pay-per-call-crypto-data-x402
- Bounty terms: https://www.blockchainiq.co/blog/x402-build-bounties
- x402 protocol: https://github.com/coinbase/x402

## License

MIT. Market data is not investment advice (see Blockchain IQ's terms).
