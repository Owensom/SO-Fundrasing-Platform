export type SubscriptionTier = "community" | "professional" | "foundation";

export type SubscriptionCapability =
  | "raffles"
  | "squares"
  | "events"
  | "auctions"
  | "advanced_branding"
  | "custom_commission"
  | "custom_domain"
  | "priority_support"
  | "platform_owner_bypass";

export type SubscriptionCapabilityResult = {
  allowed: boolean;
  reason?: string;
  upgradeTo?: SubscriptionTier;
};

export type TenantSubscriptionLike = {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  platform_owner_bypass?: boolean | null;
};

const VALID_TIERS: SubscriptionTier[] = [
  "community",
  "professional",
  "foundation",
];

export function normaliseSubscriptionTier(
  value: string | null | undefined,
): SubscriptionTier {
  if (VALID_TIERS.includes(value as SubscriptionTier)) {
    return value as SubscriptionTier;
  }

  return "community";
}

export function isSubscriptionActive(
  status: string | null | undefined,
): boolean {
  if (!status) return true;

  return ["active", "trialing", "free", "manual", "exempt"].includes(
    status.toLowerCase(),
  );
}

export function getTierLabel(tier: SubscriptionTier) {
  if (tier === "community") return "Community";
  if (tier === "professional") return "Professional";
  return "Foundation";
}

export function getTierMonthlyPriceLabel(tier: SubscriptionTier) {
  if (tier === "community") return "Free";
  if (tier === "professional") return "£25/month";
  return "£99/month";
}

export function getTierPlatformFeePercent(tier: SubscriptionTier) {
  if (tier === "community") return 7;
  if (tier === "professional") return 3.5;
  return 1.5;
}

export function getTierCapabilities(
  tier: SubscriptionTier,
): SubscriptionCapability[] {
  if (tier === "foundation") {
    return [
      "raffles",
      "squares",
      "events",
      "auctions",
      "advanced_branding",
      "custom_commission",
      "custom_domain",
      "priority_support",
      "platform_owner_bypass",
    ];
  }

  if (tier === "professional") {
    return [
      "raffles",
      "squares",
      "events",
      "auctions",
      "advanced_branding",
      "custom_commission",
    ];
  }

  return ["raffles", "squares", "events"];
}

export function checkSubscriptionCapability(
  tenant: TenantSubscriptionLike | null | undefined,
  capability: SubscriptionCapability,
): SubscriptionCapabilityResult {
  if (tenant?.platform_owner_bypass) {
    return {
      allowed: true,
    };
  }

  const tier = normaliseSubscriptionTier(tenant?.subscription_tier);
  const status = tenant?.subscription_status;

  if (!isSubscriptionActive(status)) {
    return {
      allowed: false,
      reason:
        "Your subscription is not currently active. Please update your billing to continue using this feature.",
    };
  }

  const capabilities = getTierCapabilities(tier);

  if (capabilities.includes(capability)) {
    return {
      allowed: true,
    };
  }

  if (
    capability === "auctions" ||
    capability === "advanced_branding" ||
    capability === "custom_commission"
  ) {
    return {
      allowed: false,
      upgradeTo: "professional",
      reason: "This feature requires the Professional plan or higher.",
    };
  }

  if (
    capability === "custom_domain" ||
    capability === "priority_support" ||
    capability === "platform_owner_bypass"
  ) {
    return {
      allowed: false,
      upgradeTo: "foundation",
      reason: "This feature requires the Foundation plan.",
    };
  }

  return {
    allowed: false,
    reason: "This feature is not available on your current plan.",
  };
}

export function requireSubscriptionCapability(
  tenant: TenantSubscriptionLike | null | undefined,
  capability: SubscriptionCapability,
) {
  const result = checkSubscriptionCapability(tenant, capability);

  if (!result.allowed) {
    throw new Error(result.reason || "Subscription upgrade required.");
  }

  return result;
}

export function getMaximumActiveCampaignsForTier(tier: SubscriptionTier) {
  if (tier === "community") {
    return 2;
  }

  return Number.POSITIVE_INFINITY;
}

export function canPublishAnotherCampaign(params: {
  subscription_tier?: string | null;
  currentActiveCampaigns: number;
}) {
  const tier = normaliseSubscriptionTier(params.subscription_tier);
  const limit = getMaximumActiveCampaignsForTier(tier);

  return params.currentActiveCampaigns < limit;
}

export function getCampaignLimitMessage(tier: SubscriptionTier) {
  if (tier === "community") {
    return "Community plans can publish up to 2 active campaigns at once.";
  }

  return "Unlimited active campaigns available.";
}
