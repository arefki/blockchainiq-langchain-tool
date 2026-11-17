// x402 payment client for the Blockchain IQ API.
//
// Follows Blockchain IQ's own copy-paste example
// (https://www.blockchainiq.co/agents): a viem account signs EIP-3009 USDC
// authorizations, @x402/fetch handles the 402 -> pay -> retry loop, and the
// spend control refuses any single payment above the configured cap.
// Settlement is gasless for the payer: the facilitator submits the
// transaction, so the only cost of a call is its listed price.

import { privateKeyToAccount } from "viem/accounts";
import {
  decodePaymentResponseHeader,
  wrapFetchWithPayment,
  x402Client,
} from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { extractPaymentProof, type PaymentProof } from "./payment.js";

export type PayFetch = ReturnType<typeof wrapFetchWithPayment>;

export interface BlockchainIQClientConfig {
  /** Private key (0x...) of a wallet holding USDC on Base. Omit for free tools only. */
  privateKey?: string;
  /**
   * Spend cap per single paid call, in US dollars. The x402 client refuses
   * any payment above this amount. Default 0.05 covers brief ($0.01) and
   * event-risk ($0.05); the dearest resource (analyst-pack) is $2.00.
   */
  maxUsdPerCall?: number;
  /** Underlying fetch implementation (defaults to global fetch). For tests. */
  fetchImpl?: typeof fetch;
}

export interface BlockchainIQClient {
  /** Payment-enabled fetch, or undefined when no wallet is configured. */
  payFetch?: PayFetch;
  /** Plain fetch (for free resources). */
  fetch: typeof fetch;
  /** Wallet address, when a private key was provided. */
  address?: string;
  maxUsdPerCall: number;
}

export const DEFAULT_MAX_USD_PER_CALL = 0.05;

export function createBlockchainIQClient(
  config: BlockchainIQClientConfig = {},
): BlockchainIQClient {
  const maxUsdPerCall = config.maxUsdPerCall ?? DEFAULT_MAX_USD_PER_CALL;
  const fetchImpl = config.fetchImpl ?? fetch;
  if (!config.privateKey) {
    return { fetch: fetchImpl, maxUsdPerCall };
  }
  const account = privateKeyToAccount(
    config.privateKey as `0x${string}`,
  );
  const client = x402Client.fromConfig({
    schemes: [{ network: "eip155:*", client: new ExactEvmScheme(account) }],
    spendControls: { maxAmountPerPayment: maxUsdPerCall },
  });
  return {
    payFetch: wrapFetchWithPayment(fetchImpl, client),
    fetch: fetchImpl,
    address: account.address,
    maxUsdPerCall,
  };
}

export interface CallResult {
  /** The `data` field of the API envelope (or the whole body if absent). */
  data: unknown;
  /** Settlement proof, present on paid calls that returned a PAYMENT-RESPONSE header. */
  payment?: PaymentProof;
  /** Raw PAYMENT-RESPONSE header value, when present. */
  paymentResponseHeader?: string;
}

/**
 * Call a Blockchain IQ resource URL with a payment-enabled fetch and parse
 * the envelope + settlement proof. Throws on non-2xx (a 402 here means the
 * payment was refused or failed — the x402 wrapper retries internally, so a
 * 402 reaching this point is a real failure, not the first step).
 */
export async function callPaidResource(
  payFetch: PayFetch,
  url: string,
): Promise<CallResult> {
  const res = await payFetch(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Blockchain IQ call failed (${res.status} ${res.statusText}): ${text.slice(0, 300)}`,
    );
  }
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Blockchain IQ returned a non-JSON response.");
  }
  const paymentResponseHeader =
    res.headers.get("payment-response") ?? undefined;
  let payment: PaymentProof | undefined;
  if (paymentResponseHeader) {
    try {
      payment = extractPaymentProof(
        decodePaymentResponseHeader(paymentResponseHeader),
      );
    } catch {
      payment = { raw: paymentResponseHeader };
    }
  }
  return {
    data: json.data ?? json,
    payment,
    paymentResponseHeader,
  };
}

/** Call a free resource with a plain fetch. Throws on non-2xx. */
export async function callFreeResource(
  fetchImpl: typeof fetch,
  url: string,
): Promise<CallResult> {
  const res = await fetchImpl(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Blockchain IQ call failed (${res.status} ${res.statusText}): ${text.slice(0, 300)}`,
    );
  }
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Blockchain IQ returned a non-JSON response.");
  }
  return { data: json.data ?? json };
}
