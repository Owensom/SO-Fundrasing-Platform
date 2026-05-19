import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";
import BillingSettingsForm from "./BillingSettingsForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TierKey = "community" | "professional" | "foundation";

type TenantSettingsFormState = {
  subscription_tier: TierKey;
  platform_fee_percent: number;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  stripe_connect_account_id: string;
  subscription_status: string;
  buyer_fee_contributions_enabled: boolean;
  crm_enabled: boolean;
  auctions_enabled: boolean;
  reserved_seating_enabled: boolean;
  finance_dashboard_enabled: boolean;
  white_label_enabled: boolean;
  custom_domain_enabled: boolean;
};

type TenantConnectStatus = {
  stripe_connect_account_id: string | null;
  stripe_connect_onboarding_complete: boolean | null;
  stripe_connect_charges_enabled: boolean | null;
  stripe_connect_payouts_enabled: boolean | null;
  stripe_connect_details_submitted: boolean | null;
  stripe_connect_country: string | null;
  stripe_connect_default_currency: string | null;
  stripe_connect_last_synced_at: string | null;
};

function safeTier(value: unknown): TierKey {
  if (value === "professional") return "professional";
  if (value === "foundation") return "foundation";
  return "community";
}

function defaultFeeForTier(tier: TierKey) {
  if (tier === "foundation") return 1.5;
  if (tier === "professional") return 3.5;
  return 7;
}

function safePercent(value: unknown, fallback: number) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return fallback;
  }

  return Math.min(100, Number(number.toFixed(2)));
}

function checkboxValue(formData: FormData, key: keyof TenantSettingsFormState) {
  return formData.get(key) === "on";
}

async function requireCurrentTenantAccess() {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  return tenantSlug;
}

async function getTenantConnectStatus(
  tenantSlug: string,
): Promise<TenantConnectStatus | null> {
  const rows = (await query(
    `
      select
        stripe_connect_account_id,
        stripe_connect_onboarding_complete,
        stripe_connect_charges_enabled,
        stripe_connect_payouts_enabled,
        stripe_connect_details_submitted,
        stripe_connect_country,
        stripe_connect_default_currency,
        stripe_connect_last_synced_at
      from tenants
      where slug = $1
      limit 1
    `,
    [tenantSlug],
  )) as TenantConnectStatus[];

  return rows[0] || null;
}

async function updateTenantBillingSettings(formData: FormData) {
  "use server";

  const tenantSlug = await requireCurrentTenantAccess();

  const existingSettings = await getTenantSettings(tenantSlug);
  const existingTier = safeTier(existingSettings?.subscription_tier);
  const existingPlatformFeePercent = safePercent(
    existingSettings?.platform_fee_percent,
    defaultFeeForTier(existingTier),
  );

  await query(
    `
      insert into tenant_settings (
        tenant_slug,
        subscription_tier,
        platform_fee_percent,
        stripe_customer_id,
        stripe_subscription_id,
        stripe_connect_account_id,
        subscription_status,
        buyer_fee_contributions_enabled,
        crm_enabled,
        auctions_enabled,
        reserved_seating_enabled,
        finance_dashboard_enabled,
        white_label_enabled,
        custom_domain_enabled
      )
      values (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14
      )
      on conflict (tenant_slug)
      do update set
        buyer_fee_contributions_enabled = excluded.buyer_fee_contributions_enabled,
        updated_at = now()
    `,
    [
      tenantSlug,
      existingTier,
      existingPlatformFeePercent,
      existingSettings?.stripe_customer_id || null,
      existingSettings?.stripe_subscription_id || null,
      existingSettings?.stripe_connect_account_id || null,
      existingSettings?.subscription_status || "active",
      checkboxValue(formData, "buyer_fee_contributions_enabled"),
      Boolean(existingSettings?.crm_enabled),
      Boolean(existingSettings?.auctions_enabled),
      Boolean(existingSettings?.reserved_seating_enabled),
      Boolean(existingSettings?.finance_dashboard_enabled),
      Boolean(existingSettings?.white_label_enabled),
      Boolean(existingSettings?.custom_domain_enabled),
    ],
  );

  revalidatePath("/admin/settings/billing");
  revalidatePath("/admin");
  redirect("/admin/settings/billing?saved=1");
}
export default async function AdminBillingSettingsPage() {
  const tenantSlug = await requireCurrentTenantAccess();
  const settings = await getTenantSettings(tenantSlug);
  const connectStatus = await getTenantConnectStatus(tenantSlug);

  const tier = safeTier(settings?.subscription_tier);

  const platformFeePercent = safePercent(
    settings?.platform_fee_percent,
    defaultFeeForTier(tier),
  );

  const connectAccountId =
    settings?.stripe_connect_account_id ||
    connectStatus?.stripe_connect_account_id ||
    "";

  const formState: TenantSettingsFormState = {
    subscription_tier: tier,
    platform_fee_percent: platformFeePercent,
    stripe_customer_id: settings?.stripe_customer_id || "",
    stripe_subscription_id: settings?.stripe_subscription_id || "",
    stripe_connect_account_id: connectAccountId,
    subscription_status: settings?.subscription_status || "active",
    buyer_fee_contributions_enabled: Boolean(
      settings?.buyer_fee_contributions_enabled,
    ),
    crm_enabled: Boolean(settings?.crm_enabled),
    auctions_enabled: Boolean(settings?.auctions_enabled),
    reserved_seating_enabled: Boolean(settings?.reserved_seating_enabled),
    finance_dashboard_enabled: Boolean(settings?.finance_dashboard_enabled),
    white_label_enabled: Boolean(settings?.white_label_enabled),
    custom_domain_enabled: Boolean(settings?.custom_domain_enabled),
  };

  return (
    <BillingSettingsForm
      tenantSlug={tenantSlug}
      formState={formState}
      connectStatus={connectStatus}
      updateAction={updateTenantBillingSettings}
    />
  );
}
