import { getTenantSettings } from "@/lib/tenant-settings";

export type SubscriptionTier = "community" | "professional" | "foundation";

export type FeeEngineInput = {
  tenantSlug: string;
  baseAmountCents: number;
  currency?: string;
  buyerCoversProcessingCosts?: boolean;
  buyerContributionCents?: number;
};

export type FeeEngineResult = {
  tenantSlug: string;
  subscriptionTier: SubscriptionTier;
  currency: string;

  baseAmountCents: number;
  grossAmountCents: number;

  platformFeePercent: number;
  platformFeeCents: number;

  stripeFeeEstimateCents: number;
  buyerContributionCents: number;
  buyerCoversProcessingCosts: boolean;

  organiserGrossCents: number;
  organiserNetEstimateCents: number;

  totalPlatformApplicationFeeCents: number;
};

const DEFAULT_TIER: SubscriptionTier = "community";

const DEFAULT_PLATFORM_FEES: Record<SubscriptionTier, number> = {
  community: 7,
  professional: 4,
  foundation: 2,
};

const STRIPE_PERCENT_FEE = 1.5;
const STRIPE_FIXED_FEE_CENTS = 20;

function safeMoneyCents(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.round(number);
}

function safePercent(value: unknown, fallback: number) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return fallback;
  }

  return number;
}

function normaliseTier(value: unknown): SubscriptionTier {
  if (value === "professional") return "professional";
  if (value === "foundation") return "foundation";
  return DEFAULT_TIER;
}

export function calculateStripeFeeEstimateCents(amountCents: number) {
  const cleanAmount = safeMoneyCents(amountCents);

  if (cleanAmount <= 0) {
    return 0;
  }

  return Math.ceil(
    cleanAmount * (STRIPE_PERCENT_FEE / 100) + STRIPE_FIXED_FEE_CENTS,
  );
}

export function calculatePlatformFeeCents(
  baseAmountCents: number,
  platformFeePercent: number,
) {
  const cleanAmount = safeMoneyCents(baseAmountCents);
  const cleanPercent = safePercent(platformFeePercent, 0);

  return Math.ceil(cleanAmount * (cleanPercent / 100));
}

export async function calculateFees({
  tenantSlug,
  baseAmountCents,
  currency = "GBP",
  buyerCoversProcessingCosts = false,
  buyerContributionCents = 0,
}: FeeEngineInput): Promise<FeeEngineResult> {
  const settings = await getTenantSettings(tenantSlug);

  const subscriptionTier = normaliseTier(settings?.subscription_tier);

  const platformFeePercent = safePercent(
    settings?.platform_fee_percent,
    DEFAULT_PLATFORM_FEES[subscriptionTier],
  );

  const cleanBaseAmountCents = safeMoneyCents(baseAmountCents);
  const platformFeeCents = calculatePlatformFeeCents(
    cleanBaseAmountCents,
    platformFeePercent,
  );

  const initialStripeFeeEstimateCents =
    calculateStripeFeeEstimateCents(cleanBaseAmountCents);

  const cleanBuyerContributionCents = buyerCoversProcessingCosts
    ? safeMoneyCents(buyerContributionCents)
    : 0;

  const suggestedContributionCents =
    platformFeeCents + initialStripeFeeEstimateCents;

  const finalBuyerContributionCents =
    buyerCoversProcessingCosts && cleanBuyerContributionCents > 0
      ? cleanBuyerContributionCents
      : buyerCoversProcessingCosts
        ? suggestedContributionCents
        : 0;

  const grossAmountCents =
    cleanBaseAmountCents + finalBuyerContributionCents;

  const stripeFeeEstimateCents =
    calculateStripeFeeEstimateCents(grossAmountCents);

  const organiserGrossCents = cleanBaseAmountCents;

  const organiserNetEstimateCents = Math.max(
    0,
    buyerCoversProcessingCosts
      ? cleanBaseAmountCents
      : cleanBaseAmountCents - platformFeeCents - stripeFeeEstimateCents,
  );

  const totalPlatformApplicationFeeCents = buyerCoversProcessingCosts
    ? Math.min(grossAmountCents, platformFeeCents + stripeFeeEstimateCents)
    : Math.min(grossAmountCents, platformFeeCents);

  return {
    tenantSlug,
    subscriptionTier,
    currency: currency || "GBP",

    baseAmountCents: cleanBaseAmountCents,
    grossAmountCents,

    platformFeePercent,
    platformFeeCents,

    stripeFeeEstimateCents,
    buyerContributionCents: finalBuyerContributionCents,
    buyerCoversProcessingCosts,

    organiserGrossCents,
    organiserNetEstimateCents,

    totalPlatformApplicationFeeCents,
  };
}
