// Direct tool call: fetch the $0.01 market brief (no LLM involved).
//
//   AGENT_PRIVATE_KEY=0x... npm run example:brief
//
// The wallet needs at least $0.01 USDC on Base. Settlement is gasless for
// the payer, so the only cost is the $0.01 itself.

import { createBlockchainIQTools } from "../src/tools.js";

const key = process.env.AGENT_PRIVATE_KEY;
if (!key) {
  console.error("Set AGENT_PRIVATE_KEY to a wallet holding USDC on Base.");
  process.exit(1);
}

const { brief } = createBlockchainIQTools({
  privateKey: key,
  maxUsdPerCall: 0.05,
});

const out = JSON.parse(await brief.invoke({}));
console.log("Prices:", JSON.stringify(out.data?.prices ?? out.data, null, 2));
console.log("Events (48h):", JSON.stringify(out.data?.events48h ?? [], null, 2));
console.log("Risk flags:", JSON.stringify(out.data?.riskFlags ?? [], null, 2));
console.log("\nSettlement proof:", JSON.stringify(out.payment, null, 2));
if (out.payment?.txHash) {
  console.log(`Basescan: https://basescan.org/tx/${out.payment.txHash}`);
}
