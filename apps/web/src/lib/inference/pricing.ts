/**
 * Model pricing table for token-based billing.
 * Prices are in USD per million tokens.
 * 1 credit = $0.01 USD, so multiply USD by 100 and ceil to get credits.
 */

export interface ModelPricing {
  /** USD per million input (prompt) tokens */
  inputPerMillion: number;
  /** USD per million output (completion) tokens */
  outputPerMillion: number;
}

/**
 * Pricing table keyed by model ID (as sent to the inference API).
 * Falls back to FALLBACK_PRICING for unknown models.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  "accounts/fireworks/models/kimi-k2.5": {
    inputPerMillion: 1.0,
    outputPerMillion: 3.0,
  },
  "accounts/fireworks/models/kimi-k2p5": {
    inputPerMillion: 1.0,
    outputPerMillion: 3.0,
  },
  "accounts/fireworks/models/llama-v3p1-405b-instruct": {
    inputPerMillion: 3.0,
    outputPerMillion: 3.0,
  },
  "accounts/fireworks/models/llama-v3p1-70b-instruct": {
    inputPerMillion: 0.9,
    outputPerMillion: 0.9,
  },
};

const FALLBACK_PRICING: ModelPricing = {
  inputPerMillion: 1.0,
  outputPerMillion: 3.0,
};

export interface TokenCost {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  /** Integer credits to deduct (1 credit = $0.01). Always >= 1 if any tokens used. */
  credits: number;
}

export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): TokenCost {
  const pricing = MODEL_PRICING[modelId] ?? FALLBACK_PRICING;
  const costUsd =
    (inputTokens / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion;

  // Round up to nearest credit so we never under-charge
  const credits = costUsd > 0 ? Math.max(1, Math.ceil(costUsd * 100)) : 0;

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costUsd,
    credits,
  };
}
