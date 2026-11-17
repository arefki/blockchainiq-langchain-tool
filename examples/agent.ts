// Full LangChain agent wired to the Blockchain IQ tools.
//
//   AGENT_PRIVATE_KEY=0x... OPENAI_API_KEY=sk-... npm run example:agent
//
// The agent gets all five tools (brief, event-risk, catalog, sample,
// resource) and decides which to call. The wallet needs a little USDC on
// Base; every paid call is capped at $0.05 by the spend control, so the
// agent cannot spend more than that per call however it is prompted.

import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { createBlockchainIQTools } from "../src/tools.js";

const key = process.env.AGENT_PRIVATE_KEY;
if (!key) {
  console.error("Set AGENT_PRIVATE_KEY to a wallet holding USDC on Base.");
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY) {
  console.error("Set OPENAI_API_KEY for the agent's model.");
  process.exit(1);
}

const { all } = createBlockchainIQTools({
  privateKey: key,
  maxUsdPerCall: 0.05,
});

const agent = createAgent({
  model: new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 }),
  tools: all,
  systemPrompt:
    "You are a crypto research assistant. Use the Blockchain IQ tools to " +
    "answer with fresh data. Prefer the free catalog/sample tools for " +
    "discovery, and spend at most a few cents per question.",
});

const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "Give me the crypto market brief, then tell me the most important " +
        "scheduled event in the next 7 days.",
    },
  ],
});

const last = result.messages[result.messages.length - 1];
console.log(typeof last.content === "string" ? last.content : JSON.stringify(last.content));
