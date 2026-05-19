import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TierKey = "community" | "professional" | "foundation";

type TenantBillingRow = {
  tenant_slug: string;
  subscription_tier: string | null;
  platform_fee_percent: number | string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_connect_account_id: string | null;
  subscription_status: string | null;
  buyer_fee_contributions_enabled: boolean | null;
  crm_enabled: boolean | null;
  auctions_enabled: boolean | null;
  reserved_seating_enabled: boolean | null;
  finance_dashboard_enabled: boolean | null;
  white_label_enabled: boolean | null;
  custom_domain_enabled: boolean | null;
};

type TenantBillingFormState = {
  tenant_slug: string;
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

function cleanText(value: unknown, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function safePercent(value: unknown, fallback: number) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return fallback;
  }

  return Math.min(100, Number(number.toFixed(2)));
}

function checkboxValue(formData: FormData, key: keyof TenantBillingFormState) {
  return formData.get(key) === "on";
}

function statusLabel(value: string) {
  if (value === "active") return "Active";
  if (value === "trialing") return "Trialing";
  if (value === "past_due") return "Past due";
  if (value === "cancelled") return "Cancelled";
  return value || "Unknown";
}

function tierLabel(value: TierKey) {
  if (value === "foundation") return "Foundation";
  if (value === "professional") return "Professional";
  return "Community";
}

function formatPercent(value: number) {
  return `${Number(value || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })}%`;
}

async function requirePlatformOwner() {
  const session = await auth();

  if (!session?.user || !(session.user as any).isPlatformOwner) {
    redirect("/admin/login?error=platform_owner_required");
  }

  return session;
}

function normaliseTenantBilling(row: TenantBillingRow): TenantBillingFormState {
  const tier = safeTier(row.subscription_tier);

  return {
    tenant_slug: row.tenant_slug,
    subscription_tier: tier,
    platform_fee_percent: safePercent(
      row.platform_fee_percent,
      defaultFeeForTier(tier),
    ),
    stripe_customer_id: row.stripe_customer_id || "",
    stripe_subscription_id: row.stripe_subscription_id || "",
    stripe_connect_account_id: row.stripe_connect_account_id || "",
    subscription_status: row.subscription_status || "active",
    buyer_fee_contributions_enabled: Boolean(
      row.buyer_fee_contributions_enabled,
    ),
    crm_enabled: Boolean(row.crm_enabled),
    auctions_enabled: Boolean(row.auctions_enabled),
    reserved_seating_enabled: Boolean(row.reserved_seating_enabled),
    finance_dashboard_enabled: Boolean(row.finance_dashboard_enabled),
    white_label_enabled: Boolean(row.white_label_enabled),
    custom_domain_enabled: Boolean(row.custom_domain_enabled),
  };
}

async function updatePlatformTenantBilling(formData: FormData) {
  "use server";

  await requirePlatformOwner();

  const tenantSlug = cleanText(formData.get("tenant_slug"));
  const subscriptionTier = safeTier(formData.get("subscription_tier"));
  const platformFeePercent = safePercent(
    formData.get("platform_fee_percent"),
    defaultFeeForTier(subscriptionTier),
  );

  const subscriptionStatus = cleanText(
    formData.get("subscription_status"),
    "active",
  );

  const stripeCustomerId = cleanText(formData.get("stripe_customer_id"));
  const stripeSubscriptionId = cleanText(formData.get("stripe_subscription_id"));
  const stripeConnectAccountId = cleanText(
    formData.get("stripe_connect_account_id"),
  );

  if (!tenantSlug) {
    redirect("/admin/platform/billing?error=missing_tenant");
  }

  const tenantExists = await query<{ slug: string }>(
    `
      select slug
      from tenants
      where slug = $1
      limit 1
    `,
    [tenantSlug],
  );

  if (!tenantExists[0]) {
    redirect("/admin/platform/billing?error=tenant_not_found");
  }
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
        subscription_tier = excluded.subscription_tier,
        platform_fee_percent = excluded.platform_fee_percent,
        stripe_customer_id = excluded.stripe_customer_id,
        stripe_subscription_id = excluded.stripe_subscription_id,
        stripe_connect_account_id = excluded.stripe_connect_account_id,
        subscription_status = excluded.subscription_status,
        buyer_fee_contributions_enabled = excluded.buyer_fee_contributions_enabled,
        crm_enabled = excluded.crm_enabled,
        auctions_enabled = excluded.auctions_enabled,
        reserved_seating_enabled = excluded.reserved_seating_enabled,
        finance_dashboard_enabled = excluded.finance_dashboard_enabled,
        white_label_enabled = excluded.white_label_enabled,
        custom_domain_enabled = excluded.custom_domain_enabled,
        updated_at = now()
    `,
    [
      tenantSlug,
      subscriptionTier,
      platformFeePercent,
      stripeCustomerId || null,
      stripeSubscriptionId || null,
      stripeConnectAccountId || null,
      subscriptionStatus,
      checkboxValue(formData, "buyer_fee_contributions_enabled"),
      checkboxValue(formData, "crm_enabled"),
      checkboxValue(formData, "auctions_enabled"),
      checkboxValue(formData, "reserved_seating_enabled"),
      checkboxValue(formData, "finance_dashboard_enabled"),
      checkboxValue(formData, "white_label_enabled"),
      checkboxValue(formData, "custom_domain_enabled"),
    ],
  );

  if (stripeConnectAccountId) {
    await query(
      `
        update tenants
        set
          stripe_connect_account_id = $1,
          updated_at = now()
        where slug = $2
      `,
      [stripeConnectAccountId, tenantSlug],
    );
  }

  revalidatePath("/admin/platform/billing");
  revalidatePath("/admin/settings/billing");
  revalidatePath("/admin");
  redirect(`/admin/platform/billing?saved=${encodeURIComponent(tenantSlug)}`);
}

async function getTenantBillingRows() {
  const rows = await query<TenantBillingRow>(
    `
      select
        t.slug as tenant_slug,
        ts.subscription_tier,
        ts.platform_fee_percent,
        ts.stripe_customer_id,
        ts.stripe_subscription_id,
        coalesce(ts.stripe_connect_account_id, t.stripe_connect_account_id) as stripe_connect_account_id,
        ts.subscription_status,
        ts.buyer_fee_contributions_enabled,
        ts.crm_enabled,
        ts.auctions_enabled,
        ts.reserved_seating_enabled,
        ts.finance_dashboard_enabled,
        ts.white_label_enabled,
        ts.custom_domain_enabled
      from tenants t
      left join tenant_settings ts
        on ts.tenant_slug = t.slug
      order by t.slug asc
    `,
  );

  return rows.map(normaliseTenantBilling);
}

export default async function PlatformBillingPage({
  searchParams,
}: {
  searchParams?: Promise<{
    saved?: string;
    error?: string;
  }>;
}) {
  await requirePlatformOwner();

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const tenants = await getTenantBillingRows();

  const savedTenant = cleanText(resolvedSearchParams.saved);
  const error = cleanText(resolvedSearchParams.error);

  const totalTenants = tenants.length;
  const foundationTenants = tenants.filter(
    (tenant) => tenant.subscription_tier === "foundation",
  ).length;
  const professionalTenants = tenants.filter(
    (tenant) => tenant.subscription_tier === "professional",
  ).length;
  const communityTenants = tenants.filter(
    (tenant) => tenant.subscription_tier === "community",
  ).length;

  return (
    <main className="platform-billing-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="platformHero" style={styles.hero}>
        <div style={styles.heroGlow} />

        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Platform owner controls</div>

          <h1 className="so-brand-heading title" style={styles.title}>
            Platform billing
          </h1>

          <p style={styles.subtitle}>
            Owner-only subscription, commission, Stripe and feature overrides
            across all tenant sites.
          </p>

          <div className="heroActions" style={styles.heroActions}>
            <Link href="/admin" className="heroButton" style={styles.heroButton}>
              ← Back to dashboard
            </Link>

            <Link
              href="/admin/settings/billing"
              className="heroButtonLight"
              style={styles.heroButtonLight}
            >
              Tenant billing view
            </Link>
          </div>
        </div>

        <div className="heroSummaryGrid" style={styles.heroSummaryGrid}>
          <SummaryCard label="Tenants" value={totalTenants} />
          <SummaryCard label="Foundation" value={foundationTenants} />
          <SummaryCard label="Professional" value={professionalTenants} />
          <SummaryCard label="Community" value={communityTenants} />
        </div>
      </section>

      {savedTenant ? (
        <div style={styles.successBanner}>
          Saved billing overrides for <strong>{savedTenant}</strong>.
        </div>
      ) : null}

      {error ? (
        <div style={styles.errorBanner}>
          Could not save billing override: <strong>{error}</strong>.
        </div>
      ) : null}

      <section style={styles.panel}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.kicker}>Owner override table</p>

            <h2 className="so-brand-card-title" style={styles.sectionTitle}>
              Tenant commercial settings
            </h2>

            <p style={styles.sectionText}>
              These controls are only available to the platform owner. Tenant
              admins can view their own billing page, but cannot change these
              commercial settings.
            </p>
          </div>

          <span style={styles.countPill}>{tenants.length} tenants</span>
        </div>
        {tenants.length === 0 ? (
          <div style={styles.emptyState}>No tenants found.</div>
        ) : (
          <div className="tenantGrid" style={styles.tenantGrid}>
            {tenants.map((tenant) => (
              <form
                key={tenant.tenant_slug}
                action={updatePlatformTenantBilling}
                className="tenantCard"
                style={styles.tenantCard}
              >
                <input
                  type="hidden"
                  name="tenant_slug"
                  value={tenant.tenant_slug}
                />

                <div style={styles.tenantCardHeader}>
                  <div>
                    <div style={styles.tenantSlug}>{tenant.tenant_slug}</div>
                    <div style={styles.tenantMeta}>
                      {tierLabel(tenant.subscription_tier)} ·{" "}
                      {formatPercent(tenant.platform_fee_percent)} ·{" "}
                      {statusLabel(tenant.subscription_status)}
                    </div>
                  </div>

                  <span
                    style={{
                      ...styles.tierBadge,
                      ...(tenant.subscription_tier === "foundation"
                        ? styles.tierBadgeFoundation
                        : tenant.subscription_tier === "professional"
                          ? styles.tierBadgeProfessional
                          : styles.tierBadgeCommunity),
                    }}
                  >
                    {tierLabel(tenant.subscription_tier)}
                  </span>
                </div>

                <div className="formGrid" style={styles.formGrid}>
                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Subscription tier</span>
                    <select
                      name="subscription_tier"
                      defaultValue={tenant.subscription_tier}
                      style={styles.input}
                    >
                      <option value="community">Community</option>
                      <option value="professional">Professional</option>
                      <option value="foundation">Foundation</option>
                    </select>
                  </label>

                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Platform fee %</span>
                    <input
                      type="number"
                      name="platform_fee_percent"
                      defaultValue={tenant.platform_fee_percent}
                      min="0"
                      max="100"
                      step="0.1"
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Subscription status</span>
                    <select
                      name="subscription_status"
                      defaultValue={tenant.subscription_status}
                      style={styles.input}
                    >
                      <option value="active">Active</option>
                      <option value="trialing">Trialing</option>
                      <option value="past_due">Past due</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </label>

                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Stripe customer ID</span>
                    <input
                      type="text"
                      name="stripe_customer_id"
                      defaultValue={tenant.stripe_customer_id}
                      placeholder="cus_xxxxxxxxx"
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Stripe subscription ID</span>
                    <input
                      type="text"
                      name="stripe_subscription_id"
                      defaultValue={tenant.stripe_subscription_id}
                      placeholder="sub_xxxxxxxxx"
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Stripe Connect account</span>
                    <input
                      type="text"
                      name="stripe_connect_account_id"
                      defaultValue={tenant.stripe_connect_account_id}
                      placeholder="acct_xxxxxxxxx"
                      style={styles.input}
                    />
                  </label>
                </div>

                <div className="toggleGrid" style={styles.toggleGrid}>
                  <ToggleField
                    name="buyer_fee_contributions_enabled"
                    label="Buyer contributions"
                    checked={tenant.buyer_fee_contributions_enabled}
                  />

                  <ToggleField
                    name="crm_enabled"
                    label="CRM"
                    checked={tenant.crm_enabled}
                  />

                  <ToggleField
                    name="auctions_enabled"
                    label="Auctions"
                    checked={tenant.auctions_enabled}
                  />

                  <ToggleField
                    name="reserved_seating_enabled"
                    label="Reserved seating"
                    checked={tenant.reserved_seating_enabled}
                  />

                  <ToggleField
                    name="finance_dashboard_enabled"
                    label="Finance dashboard"
                    checked={tenant.finance_dashboard_enabled}
                  />

                  <ToggleField
                    name="white_label_enabled"
                    label="White label"
                    checked={tenant.white_label_enabled}
                  />

                  <ToggleField
                    name="custom_domain_enabled"
                    label="Custom domain"
                    checked={tenant.custom_domain_enabled}
                  />
                </div>

                <div style={styles.cardFooter}>
                  <Link
                    href={`/c/${tenant.tenant_slug}?adminReturn=/admin/platform/billing`}
                    target="_blank"
                    style={styles.previewLink}
                  >
                    View public site
                  </Link>

                  <button type="submit" style={styles.saveButton}>
                    Save owner overrides
                  </button>
                </div>
              </form>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.summaryCard}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </div>
  );
}

function ToggleField({
  name,
  label,
  checked,
}: {
  name: keyof TenantBillingFormState;
  label: string;
  checked: boolean;
}) {
  return (
    <label style={styles.toggleCard}>
      <input type="checkbox" name={name} defaultChecked={checked} />

      <span style={styles.toggleLabel}>{label}</span>
    </label>
  );
}

const responsiveStyles = `
.platform-billing-page,
.platform-billing-page * {
  box-sizing: border-box;
}

.platform-billing-page {
  overflow-x: hidden;
}

.platform-billing-page section,
.platform-billing-page div,
.platform-billing-page form,
.platform-billing-page label {
  min-width: 0;
}

@media (max-width: 980px) {
  .platform-billing-page .platformHero,
  .platform-billing-page .heroSummaryGrid,
  .platform-billing-page .formGrid,
  .platform-billing-page .toggleGrid {
    grid-template-columns: 1fr !important;
  }

  .platform-billing-page .heroActions,
  .platform-billing-page .cardFooter {
    grid-template-columns: 1fr !important;
  }

  .platform-billing-page .heroButton,
  .platform-billing-page .heroButtonLight,
  .platform-billing-page .previewLink,
  .platform-billing-page .saveButton {
    width: 100% !important;
    justify-content: center !important;
    text-align: center !important;
  }
}

@media (max-width: 620px) {
  .platform-billing-page {
    padding: 14px 10px 42px !important;
  }

  .platform-billing-page .platformHero,
  .platform-billing-page .panel,
  .platform-billing-page .tenantCard {
    padding: 16px !important;
    border-radius: 22px !important;
  }

  .platform-billing-page .title {
    font-size: clamp(34px, 12vw, 48px) !important;
    line-height: 0.98 !important;
  }

  .platform-billing-page .tenantCardHeader {
    grid-template-columns: 1fr !important;
  }
}
`;
const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1320,
    margin: "0 auto",
    padding: "28px 16px 64px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 32%), radial-gradient(circle at top right, rgba(15,23,42,0.05), transparent 34%), #f8fafc",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  hero: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)",
    gap: 22,
    padding: 30,
    borderRadius: 34,
    background:
      "radial-gradient(circle at bottom right, rgba(37,99,235,0.20), transparent 38%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 28px 70px rgba(15,23,42,0.22)",
    overflow: "hidden",
    border: "1px solid rgba(148,163,184,0.22)",
  },

  heroGlow: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(circle at 18% 24%, rgba(255,255,255,0.07), transparent 28%)",
  },

  heroContent: {
    position: "relative",
    zIndex: 1,
    minWidth: 0,
  },

  eyebrow: {
    display: "inline-flex",
    padding: "8px 14px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.24)",
    color: "#facc15",
    border: "1px solid rgba(250,204,21,0.76)",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 16,
  },

  title: {
    margin: 0,
    fontSize: "clamp(48px, 7vw, 78px)",
    lineHeight: 0.94,
    letterSpacing: "-0.075em",
    color: "#ffffff",
    overflowWrap: "anywhere",
    textShadow: "0 18px 45px rgba(0,0,0,0.22)",
  },

  subtitle: {
    margin: "18px 0 0",
    maxWidth: 780,
    color: "#dbeafe",
    fontSize: 18,
    lineHeight: 1.6,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  heroActions: {
    marginTop: 24,
    display: "grid",
    gridTemplateColumns: "repeat(2, max-content)",
    gap: 10,
  },

  heroButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "11px 16px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    border: "1px solid #1683f8",
  },

  heroButtonLight: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "11px 16px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    border: "1px solid rgba(148,163,184,0.52)",
  },

  heroSummaryGrid: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    alignContent: "start",
  },

  summaryCard: {
    display: "grid",
    gap: 7,
    padding: 16,
    borderRadius: 22,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.26)",
    minWidth: 0,
  },

  summaryLabel: {
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  summaryValue: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: 950,
    letterSpacing: "-0.055em",
    overflowWrap: "anywhere",
  },

  successBanner: {
    padding: 14,
    borderRadius: 18,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontWeight: 900,
    marginBottom: 14,
  },

  errorBanner: {
    padding: 14,
    borderRadius: 18,
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    fontWeight: 900,
    marginBottom: 14,
  },

  panel: {
    padding: 22,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    alignItems: "flex-start",
    marginBottom: 18,
  },

  kicker: {
    margin: "0 0 7px",
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 30,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.6,
    maxWidth: 760,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  countPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 950,
  },

  tenantGrid: {
    display: "grid",
    gap: 16,
  },

  tenantCard: {
    display: "grid",
    gap: 16,
    padding: 18,
    borderRadius: 24,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },

  tenantCardHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "start",
  },

  tenantSlug: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
  },

  tenantMeta: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 13,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  tierBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  tierBadgeCommunity: {
    background: "#f8fafc",
    color: "#475569",
    border: "1px solid #cbd5e1",
  },

  tierBadgeProfessional: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
  },

  tierBadgeFoundation: {
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  },

  field: {
    display: "grid",
    gap: 7,
    minWidth: 0,
  },

  fieldLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
  },

  input: {
    width: "100%",
    minWidth: 0,
    minHeight: 44,
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "10px 12px",
    fontSize: 15,
    boxSizing: "border-box",
  },

  toggleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
  },

  toggleCard: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 9,
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    color: "#334155",
    fontSize: 13,
    fontWeight: 850,
    minWidth: 0,
    cursor: "pointer",
  },

  toggleLabel: {
    overflowWrap: "anywhere",
  },

  cardFooter: {
    display: "grid",
    gridTemplateColumns: "max-content max-content",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },

  previewLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 950,
  },

  saveButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    padding: "10px 16px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "1px solid #1683f8",
    fontWeight: 950,
    cursor: "pointer",
  },

  emptyState: {
    padding: 18,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 850,
    textAlign: "center",
  },
};
