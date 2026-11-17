// Test call for the Blockchain IQ x402 integration.
//
//   npm run test:call:dry   — dry run (default): validates everything EXCEPT
//                             the payment. Costs nothing. Run this first.
//   npm run test:call -- --live
//                           — real paid call: $0.01 USDC on Base to `brief`
//                             through the LangChain tool. Needs
//                             AGENT_PRIVATE_KEY (a wallet holding USDC on
//                             Base). Prints the settlement proof and writes
//                             test-call-proof.json (repo root) for the claim.
//
// The dry run:
//   1. fetches the free catalogue and confirms `brief` costs $0.01;
//   2. fetches the free sample and confirms the API answers;
//   3. makes an UNPAID call to /brief and confirms it returns HTTP 402 with
//      a PAYMENT-REQUIRED header naming $0.01 USDC on Base to Blockchain
//      IQ's pay-to address — i.e. the paid call would work, without paying;
//   4. if AGENT_PRIVATE_KEY is set, derives the wallet address and checks
//      its USDC balance on Base (read-only) — must be >= $0.01 for --live.
//
// Settlement is gasless for the payer (EIP-3009): the only cost of the live
// call is the $0.01 itself.

import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { writeFileSync } from "node:fs";
import { createBlockchainIQTools } from "../src/tools.js";
import {
  API_BASE,
  PAY_TO_BASE,
  USDC_BASE_ADDRESS,
} from "../src/resources.js";
import {
  decodePaymentRequiredHeader,
  firstAccept,
  atomicToUsd,
} from "../src/payment.js";

const USDC_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

interface Args {
  live: boolean;
  maxUsd: number;
  proofOut: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { live: false, maxUsd: 0.05, proofOut: "test-call-proof.json" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--live") args.live = true;
    else if (argv[i] === "--dry-run") args.live = false;
    else if (argv[i] === "--max-usd") args.maxUsd = Number(argv[++i]);
    else if (argv[i] === "--proof-out") args.proofOut = argv[++i];
  }
  return args;
}

function fail(message: string): never {
  console.error(`\n✗ FAIL: ${message}`);
  process.exit(1);
}

async function dryRun(): Promise<void> {
  console.log("Blockchain IQ x402 — DRY RUN (no payment, nothing spent)\n");

  // 1. Free catalogue: brief must be listed at $0.01.
  console.log("[1/4] Fetching the free catalogue…");
  const catalogRes = await fetch(API_BASE);
  if (!catalogRes.ok) fail(`catalogue fetch failed: HTTP ${catalogRes.status}`);
  const catalog = (await catalogRes.json()) as {
    data?: Array<{ id?: string; path?: string; price?: string }>;
    paymentRails?: Array<{ networkName?: string; payTo?: string }>;
  };
  const brief = (catalog.data ?? []).find((r) => r.id === "brief");
  if (!brief) fail("catalogue has no `brief` resource.");
  console.log(`      brief: path=${brief.path} price=${brief.price}`);
  if (brief.price !== "$0.01") {
    fail(`brief price changed: expected $0.01, catalogue says ${brief.price}.`);
  }
  const baseRail = (catalog.paymentRails ?? []).find(
    (r) => r.networkName === "base",
  );
  if (baseRail?.payTo && baseRail.payTo.toLowerCase() !== PAY_TO_BASE.toLowerCase()) {
    fail(`Base pay-to address changed: catalogue says ${baseRail.payTo}.`);
  }
  console.log("      ✓ brief is $0.01, pay-to matches the catalogue.");

  // 2. Free sample: the API must answer with data. A 503 is the API's
  //    documented "figures missing or more than 3 days old" state — a
  //    warning, not a failure of the integration (the paid call does not
  //    depend on the sample).
  console.log("[2/4] Fetching the free sample…");
  const sampleRes = await fetch(`${API_BASE}/sample`);
  if (sampleRes.status === 503) {
    console.log("      ⚠ sample returned HTTP 503 (figures stale/missing per");
    console.log("        the catalogue) — warning only, the paid call is unaffected.");
  } else {
    if (!sampleRes.ok) fail(`sample fetch failed: HTTP ${sampleRes.status}`);
    const sample = (await sampleRes.json()) as { data?: { chain?: string } };
    if (!sample.data?.chain) fail("sample returned no data.");
    console.log(`      ✓ sample OK (chain=${sample.data.chain}).`);
  }

  // 3. Unpaid call to /brief: must be HTTP 402 with a PAYMENT-REQUIRED
  //    header naming $0.01 USDC on Base to Blockchain IQ.
  console.log("[3/4] Unpaid call to /brief (expecting HTTP 402)…");
  const unpaidRes = await fetch(`${API_BASE}/brief`);
  if (unpaidRes.status !== 402) {
    fail(`expected HTTP 402, got ${unpaidRes.status}.`);
  }
  const header = unpaidRes.headers.get("payment-required");
  if (!header) fail("402 response has no PAYMENT-REQUIRED header.");
  const requirements = decodePaymentRequiredHeader(header);
  console.log("      decoded PAYMENT-REQUIRED header:");
  console.log(`      ${JSON.stringify(requirements)}`);
  const accept = firstAccept(requirements);
  if (!accept) fail("PAYMENT-REQUIRED header names no accepted payment.");
  const amountAtomic =
    accept.amount ??
    accept.maxAmountRequired ??
    (accept as { maxAmount?: string }).maxAmount;
  if (!amountAtomic) fail("PAYMENT-REQUIRED header names no amount.");
  const priceUsd = atomicToUsd(amountAtomic);
  console.log(
    `      price=$${priceUsd.toFixed(2)} asset=${accept.asset} network=${accept.network} payTo=${accept.payTo}`,
  );
  if (priceUsd !== 0.01) fail(`402 price is $${priceUsd}, expected $0.01.`);
  if (accept.network !== "eip155:8453") {
    fail(`402 network is ${accept.network}, expected eip155:8453 (Base).`);
  }
  if (
    accept.asset &&
    accept.asset.toLowerCase() !== USDC_BASE_ADDRESS.toLowerCase()
  ) {
    fail(`402 asset is ${accept.asset}, expected Base USDC ${USDC_BASE_ADDRESS}.`);
  }
  if (
    accept.payTo &&
    accept.payTo.toLowerCase() !== PAY_TO_BASE.toLowerCase()
  ) {
    fail(`402 payTo is ${accept.payTo}, expected ${PAY_TO_BASE}.`);
  }
  console.log("      ✓ 402 names $0.01 USDC on Base to Blockchain IQ.");

  // 4. Wallet readiness (read-only): if a key is set, check the USDC balance.
  console.log("[4/4] Wallet readiness (read-only)…");
  const key = process.env.AGENT_PRIVATE_KEY;
  if (!key) {
    console.log("      AGENT_PRIVATE_KEY is not set — the live run needs it.");
    console.log("      (Set it to a wallet holding >= $0.01 USDC on Base.)");
  } else {
    const account = privateKeyToAccount(key as `0x${string}`);
    console.log(`      wallet: ${account.address}`);
    const client = createPublicClient({ chain: base, transport: http() });
    const balance = (await client.readContract({
      address: USDC_BASE_ADDRESS as `0x${string}`,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [account.address],
    })) as bigint;
    console.log(`      USDC balance on Base: $${formatUnits(balance, 6)}`);
    if (balance < 10_000n) {
      fail("wallet holds less than $0.01 USDC on Base — fund it before --live.");
    }
    console.log("      ✓ wallet holds enough USDC for the $0.01 test call.");
  }

  console.log("\n✓ DRY RUN PASSED — the paid call is ready to go.");
  console.log("  Live command (spends $0.01 USDC on Base, gasless):");
  console.log("    AGENT_PRIVATE_KEY=0x... npm run test:call -- --live");
}

async function liveRun(maxUsd: number, proofOut: string): Promise<void> {
  console.log("Blockchain IQ x402 — LIVE TEST CALL ($0.01 USDC on Base)\n");
  const key = process.env.AGENT_PRIVATE_KEY;
  if (!key) {
    fail("AGENT_PRIVATE_KEY is not set. Refusing to run without a wallet.");
  }
  if (maxUsd < 0.01) fail("--max-usd must be at least 0.01 for the brief call.");

  const { brief, client } = createBlockchainIQTools({
    privateKey: key,
    maxUsdPerCall: maxUsd,
  });
  console.log(`  wallet:  ${client.address}`);
  console.log(`  cap:     $${maxUsd.toFixed(2)} per call`);
  console.log(`  calling: blockchainiq_brief ($0.01)…\n`);

  const out = await brief.invoke({});
  const parsed = JSON.parse(out) as {
    resource?: string;
    priceUsd?: number;
    data?: unknown;
    payment?: { txHash?: string; payer?: string; network?: string };
  };
  if (!parsed.payment?.txHash) {
    fail(
      "the call returned no settlement transaction hash — the payment may not have settled. Raw output:\n" +
        out.slice(0, 1000),
    );
  }
  const proof = {
    resource: parsed.resource ?? "brief",
    priceUsd: parsed.priceUsd ?? 0.01,
    txHash: parsed.payment.txHash,
    payer: parsed.payment.payer ?? client.address,
    network: parsed.payment.network ?? "eip155:8453",
    basescanUrl: `https://basescan.org/tx/${parsed.payment.txHash}`,
    tool: "blockchainiq_brief",
    apiBase: API_BASE,
    timestamp: new Date().toISOString(),
  };
  writeFileSync(proofOut, JSON.stringify(proof, null, 2) + "\n");

  console.log("✓ PAID CALL SUCCEEDED");
  console.log(`  tx hash:   ${proof.txHash}`);
  console.log(`  basescan:  ${proof.basescanUrl}`);
  console.log(`  payer:     ${proof.payer}`);
  console.log(`  proof:     ${proofOut}`);
  console.log("\n  Data (truncated):");
  console.log(`  ${JSON.stringify(parsed.data).slice(0, 400)}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.live) await liveRun(args.maxUsd, args.proofOut);
  else await dryRun();
}

main().catch((error: unknown) => {
  console.error(`\n✗ ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
