import { getTenantSettings } from "@/lib/tenant-settings";

export async function canUseAuctions(tenantSlug: string) {
  const settings = await getTenantSettings(tenantSlug);

  if (!settings) return false;

  return (
    settings.subscription_tier === "professional" ||
    settings.subscription_tier === "foundation" ||
    settings.auctions_enabled
  );
}

export async function canUseCRM(tenantSlug: string) {
  const settings = await getTenantSettings(tenantSlug);

  if (!settings) return false;

  return (
    settings.subscription_tier === "professional" ||
    settings.subscription_tier === "foundation" ||
    settings.crm_enabled
  );
}

export async function canUseReservedSeating(tenantSlug: string) {
  const settings = await getTenantSettings(tenantSlug);

  if (!settings) return false;

  return (
    settings.subscription_tier === "professional" ||
    settings.subscription_tier === "foundation" ||
    settings.reserved_seating_enabled
  );
}

export async function canUseFinanceDashboard(tenantSlug: string) {
  const settings = await getTenantSettings(tenantSlug);

  if (!settings) return false;

  return (
    settings.subscription_tier === "professional" ||
    settings.subscription_tier === "foundation" ||
    settings.finance_dashboard_enabled
  );
}

export async function canUseWhiteLabel(tenantSlug: string) {
  const settings = await getTenantSettings(tenantSlug);

  if (!settings) return false;

  return (
    settings.subscription_tier === "foundation" ||
    settings.white_label_enabled
  );
}
