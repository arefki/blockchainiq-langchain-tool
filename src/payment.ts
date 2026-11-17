// Helpers for the x402 v2 payment headers.
//
// Flow (https://www.blockchainiq.co/agents):
//   1. Plain GET -> HTTP 402 with a PAYMENT-REQUIRED header (base64 JSON)
//      naming the price, asset (USDC), network and pay-to address.
//   2. The x402 client signs a USDC payment (EIP-3009, gasless for the
//      payer) and retries with it.
//   3. HTTP 200 with JSON, plus a PAYMENT-RESPONSE header carrying the
//      settlement proof (payer, network, transaction hash).
// A 404 or an error response is never charged.

export interface PaymentAccept {
  scheme?: string;
  network?: string;
  /** Amount in the asset's smallest unit, as a decimal string (x402 v2). */
  amount?: string;
  /** Same amount under its x402 v1 name; kept as a fallback. */
  maxAmountRequired?: string;
  /** Token contract address (USDC on Base) or asset identifier. */
  asset?: string;
  payTo?: string;
  maxTimeoutSeconds?: number;
  [key: string]: unknown;
}

export interface PaymentRequirements {
  x402Version?: number;
  error?: string;
  accepts?: PaymentAccept[];
  [key: string]: unknown;
}

export interface PaymentProof {
  /** Settlement transaction hash (Base), when the server reported one. */
  txHash?: string;
  payer?: string;
  network?: string;
  /** The decoded PAYMENT-RESPONSE header, verbatim. */
  raw: unknown;
}

/**
 * Decode a PAYMENT-REQUIRED header value (base64 JSON) into its object
 * form. Throws on malformed input.
 */
export function decodePaymentRequiredHeader(
  value: string,
): PaymentRequirements {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Empty PAYMENT-REQUIRED header.");
  let json: string;
  try {
    json = Buffer.from(trimmed, "base64").toString("utf-8");
  } catch {
    throw new Error("PAYMENT-REQUIRED header is not valid base64.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("PAYMENT-REQUIRED header is not valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("PAYMENT-REQUIRED header did not decode to an object.");
  }
  return parsed as PaymentRequirements;
}

/** First accepted payment option, if the requirements name one. */
export function firstAccept(
  requirements: PaymentRequirements,
): PaymentAccept | undefined {
  const accepts = requirements.accepts;
  if (!Array.isArray(accepts) || accepts.length === 0) return undefined;
  return accepts[0];
}

/** USDC has 6 decimals: convert an atomic-unit amount string to dollars. */
export function atomicToUsd(amountAtomic: string, decimals = 6): number {
  const value = BigInt(amountAtomic);
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const frac = value % divisor;
  return Number(whole) + Number(frac) / Number(divisor);
}

/**
 * Pull the settlement transaction hash (and payer/network, when present)
 * out of a decoded PAYMENT-RESPONSE header. Field names have varied across
 * @x402/fetch versions, so check the known spellings.
 */
export function extractPaymentProof(decoded: unknown): PaymentProof {
  if (typeof decoded !== "object" || decoded === null) {
    return { raw: decoded };
  }
  const obj = decoded as Record<string, unknown>;
  const txHash =
    typeof obj.transaction === "string"
      ? obj.transaction
      : typeof obj.txHash === "string"
        ? obj.txHash
        : typeof obj.hash === "string"
          ? obj.hash
          : undefined;
  const payer =
    typeof obj.payer === "string" ? obj.payer : undefined;
  const network =
    typeof obj.network === "string" ? obj.network : undefined;
  return { txHash, payer, network, raw: decoded };
}
