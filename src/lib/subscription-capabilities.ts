export type SubscriptionTier = "community" | "professional" | "foundation";

export type SubscriptionCapability =
  | "raffles"
  | "squares"
  | "events"
  | "auctions"
  | "merchandise"
  | "custom_campaign_images"
  | "advanced_branding"
  | "custom_commission"
  | "custom_domain"
  | "priority_support"
  | "platform_owner_bypass"
  | "event_guest_catering_edit"
  | "event_guest_menu_request_emails"
  | "event_vip_access_codes"
  | "event_fundraising_addons"
  | "multiple_event_fundraising_addons";

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

export type EventFundraisingAddOnType = "heads_or_tails" | "higher_or_lower";

export type EventFundraisingAddOnLimits = {
  enabled: boolean;
  maxAddOnsPerEvent: number;
  allowedTypes: EventFundraisingAddOnType[];
};

const VALID_TIERS: SubscriptionTier[] = [
  "community",
  "professional",
  "foundation",
];

const PROFESSIONAL_EVENT_FUNDRAISING_ADD_ON_TYPES: EventFundraisingAddOnType[] =
  ["heads_or_tails", "higher_or_lower"];

const FOUNDATION_EVENT_FUNDRAISING_ADD_ON_TYPES: EventFundraisingAddOnType[] = [
  "heads_or_tails",
  "higher_or_lower",
];

function cleanSubscriptionValue(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export function normaliseSubscriptionTier(
  value: string | null | undefined,
): SubscriptionTier {
  const clean = cleanSubscriptionValue(value);

  if (VALID_TIERS.includes(clean as SubscriptionTier)) {
    return clean as SubscriptionTier;
  }

  return "community";
}

export function isSubscriptionActive(
  status: string | null | undefined,
): boolean {
  const clean = cleanSubscriptionValue(status);

  if (!clean) return true;

  return ["active", "trialing", "free", "manual", "exempt"].includes(clean);
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
      "merchandise",
      "custom_campaign_images",
      "advanced_branding",
      "custom_commission",
      "custom_domain",
      "priority_support",
      "platform_owner_bypass",
      "event_guest_catering_edit",
      "event_guest_menu_request_emails",
      "event_vip_access_codes",
      "event_fundraising_addons",
      "multiple_event_fundraising_addons",
    ];
  }

  if (tier === "professional") {
    return [
      "raffles",
      "squares",
      "events",
      "auctions",
      "merchandise",
      "custom_campaign_images",
      "custom_commission",
      "event_guest_catering_edit",
      "event_vip_access_codes",
      "event_fundraising_addons",
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
    capability === "merchandise" ||
    capability === "custom_campaign_images" ||
    capability === "custom_commission" ||
    capability === "event_guest_catering_edit" ||
    capability === "event_vip_access_codes" ||
    capability === "event_fundraising_addons"
  ) {
    return {
      allowed: false,
      upgradeTo: "professional",
      reason: "This feature requires the Professional plan or higher.",
    };
  }

  if (
    capability === "advanced_branding" ||
    capability === "custom_domain" ||
    capability === "priority_support" ||
    capability === "platform_owner_bypass" ||
    capability === "event_guest_menu_request_emails" ||
    capability === "multiple_event_fundraising_addons"
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

export function getEventFundraisingAddOnLimits(
  tier: SubscriptionTier,
): EventFundraisingAddOnLimits {
  if (tier === "foundation") {
    return {
      enabled: true,
      maxAddOnsPerEvent: Number.POSITIVE_INFINITY,
      allowedTypes: FOUNDATION_EVENT_FUNDRAISING_ADD_ON_TYPES,
    };
  }

  if (tier === "professional") {
    return {
      enabled: true,
      maxAddOnsPerEvent: 1,
      allowedTypes: PROFESSIONAL_EVENT_FUNDRAISING_ADD_ON_TYPES,
    };
  }

  return {
    enabled: false,
    maxAddOnsPerEvent: 0,
    allowedTypes: [],
  };
}

export function getTenantEventFundraisingAddOnLimits(
  tenant: TenantSubscriptionLike | null | undefined,
): EventFundraisingAddOnLimits {
  if (tenant?.platform_owner_bypass) {
    return {
      enabled: true,
      maxAddOnsPerEvent: Number.POSITIVE_INFINITY,
      allowedTypes: FOUNDATION_EVENT_FUNDRAISING_ADD_ON_TYPES,
    };
  }

  const tier = normaliseSubscriptionTier(tenant?.subscription_tier);

  if (!isSubscriptionActive(tenant?.subscription_status)) {
    return {
      enabled: false,
      maxAddOnsPerEvent: 0,
      allowedTypes: [],
    };
  }

  return getEventFundraisingAddOnLimits(tier);
}

export function canUseEventFundraisingAddOnType(params: {
  tenant: TenantSubscriptionLike | null | undefined;
  addOnType: EventFundraisingAddOnType;
}) {
  const limits = getTenantEventFundraisingAddOnLimits(params.tenant);

  return limits.enabled && limits.allowedTypes.includes(params.addOnType);
}

export function getCustomCampaignImagesUpgradeMessage() {
  return "Custom campaign images require the Professional plan or higher. Community campaigns use the platform default images.";
}

export function getAdvancedBrandingUpgradeMessage() {
  return "Advanced public and email branding requires the Foundation plan.";
}

export function getEventGuestCateringEditUpgradeMessage() {
  return "Editing guest names, dietary requirements and menu choices after purchase requires the Professional plan or higher.";
}

export function getEventGuestMenuRequestEmailsUpgradeMessage() {
  return "Sending secure menu-choice request emails requires the Foundation plan.";
}

export function getEventVipAccessCodesUpgradeMessage() {
  return "VIP and complimentary event access codes require the Professional plan or higher.";
}

export function getEventFundraisingAddOnsUpgradeMessage() {
  return "Event fundraising add-ons such as Heads or Tails and Higher or Lower require the Professional plan or higher.";
}

export function getMultipleEventFundraisingAddOnsUpgradeMessage() {
  return "Multiple event fundraising add-ons per event require the Foundation plan.";
}

export function getMerchandiseUpgradeMessage() {
  return "Merchandise and shop fundraising require the Professional plan or higher.";
}
