import { query } from "@/lib/db";

export type TenantSettings = {
  tenant_slug: string;
  subscription_tier: "community" | "professional" | "foundation";
  platform_fee_percent: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_connect_account_id: string | null;
  subscription_status: string;
  buyer_fee_contributions_enabled: boolean;
  crm_enabled: boolean;
  auctions_enabled: boolean;
  reserved_seating_enabled: boolean;
  finance_dashboard_enabled: boolean;
  white_label_enabled: boolean;
  custom_domain_enabled: boolean;
};

export async function getTenantSettings(
  tenantSlug: string,
): Promise<TenantSettings | null> {
  const rows = await query<TenantSettings>(
    `
      select *
      from tenant_settings
      where tenant_slug = $1
      limit 1
    `,
    [tenantSlug],
  );

  return rows[0] || null;
}
