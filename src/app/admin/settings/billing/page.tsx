import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";

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

const TIER_DETAILS: Record<
  TierKey,
  {
    name: string;
    monthly: string;
    fee: string;
    description: string;
    features: string[];
  }
> = {
  community: {
    name: "Community",
    monthly: "Free",
    fee: "7%",
    description:
      "Accessible fundraising for smaller organisers and first campaigns.",
    features: [
      "Raffles",
      "Squares",
      "Simple campaigns",
      "Public campaign pages",
      "Optional supporter processing-cost contribution",
    ],
  },
  professional: {
    name: "Professional",
    monthly: "£25/month",
    fee: "4%",
    description:
      "Premium fundraising tools for schools, clubs and growing charities.",
    features: [
      "Events",
      "Auctions",
      "CRM",
      "Finance dashboard",
      "Branding controls",
      "Customer exports",
    ],
  },
  foundation: {
    name: "Foundation",
    monthly: "£99/month",
    fee: "2%",
    description:
      "Advanced operating infrastructure for larger fundraising organisations.",
    features: [
      "Lower platform fee",
      "Advanced reporting",
      "Stripe Connect ready",
      "Priority support",
      "White-label direction",
      "Large-scale operations",
    ],
  },
};

function safeTier(value: unknown): TierKey {
  if (value === "professional") return "professional";
  if (value === "foundation") return "foundation";
  return "community";
}

function defaultFeeForTier(tier: TierKey) {
  if (tier === "foundation") return 2;
  if (tier === "professional") return 4;
  return 7;
}

function safePercent(value: unknown, fallback: number) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return fallback;
  }

  return Math.min(100, Number(number.toFixed(2)));
}

function cleanText(value: FormDataEntryValue | null, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function checkboxValue(formData: FormData, key: keyof TenantSettingsFormState) {
  return formData.get(key) === "on";
}

function enabledLabel(value: boolean) {
  return value ? "Enabled" : "Not enabled";
}

function enabledStyle(value: boolean): CSSProperties {
  return value ? styles.enabledPill : styles.disabledPill;
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

async function updateTenantBillingSettings(formData: FormData) {
  "use server";

  const tenantSlug = await requireCurrentTenantAccess();

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
  const stripeSubscriptionId = cleanText(
    formData.get("stripe_subscription_id"),
  );
  const stripeConnectAccountId = cleanText(
    formData.get("stripe_connect_account_id"),
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

  revalidatePath("/admin/settings/billing");
  revalidatePath("/admin");
  redirect("/admin/settings/billing?saved=1");
}

export default async function AdminBillingSettingsPage() {
  const tenantSlug = await requireCurrentTenantAccess();
  const settings = await getTenantSettings(tenantSlug);

  const tier = safeTier(settings?.subscription_tier);
  const currentTier = TIER_DETAILS[tier];

  const platformFeePercent = safePercent(
    settings?.platform_fee_percent,
    defaultFeeForTier(tier),
  );

  const formState: TenantSettingsFormState = {
    subscription_tier: tier,
    platform_fee_percent: platformFeePercent,
    stripe_customer_id: settings?.stripe_customer_id || "",
    stripe_subscription_id: settings?.stripe_subscription_id || "",
    stripe_connect_account_id: settings?.stripe_connect_account_id || "",
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

  const capabilities = [
    {
      label: "CRM",
      key: "crm_enabled" as const,
      enabled: formState.crm_enabled || tier !== "community",
    },
    {
      label: "Auctions",
      key: "auctions_enabled" as const,
      enabled: formState.auctions_enabled || tier !== "community",
    },
    {
      label: "Reserved seating",
      key: "reserved_seating_enabled" as const,
      enabled: formState.reserved_seating_enabled || tier !== "community",
    },
    {
      label: "Finance dashboard",
      key: "finance_dashboard_enabled" as const,
      enabled: formState.finance_dashboard_enabled || tier !== "community",
    },
    {
      label: "White label",
      key: "white_label_enabled" as const,
      enabled: formState.white_label_enabled || tier === "foundation",
    },
    {
      label: "Custom domain",
      key: "custom_domain_enabled" as const,
      enabled: formState.custom_domain_enabled || tier === "foundation",
    },
  ];

  return (
    <main className="billing-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="hero" style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Tenant billing</div>

          <h1 className="so-brand-heading title" style={styles.title}>
            Billing & subscription
          </h1>

          <p style={styles.subtitle}>
            Manage this tenant’s plan, platform commission, Stripe readiness and
            commercial feature settings.
          </p>

          <p style={styles.tenantLine}>
            Tenant: <strong>{tenantSlug}</strong>
          </p>

          <div className="heroActions" style={styles.heroActions}>
            <Link href="/admin" className="heroButton" style={styles.heroButton}>
              ← Back to dashboard
            </Link>

            <Link
              href="/admin/metadata"
              className="heroButtonLight"
              style={styles.heroButtonLight}
            >
              Finance dashboard
            </Link>
          </div>
        </div>

        <div className="heroSummaryGrid" style={styles.heroSummaryGrid}>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Current plan</div>
            <div style={styles.summaryValue}>{currentTier.name}</div>
            <div style={styles.summarySub}>
              {currentTier.monthly} · {currentTier.fee} platform fee
            </div>
          </div>

          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Platform commission</div>
            <div style={styles.summaryValue}>
              {platformFeePercent.toFixed(1)}%
            </div>
            <div style={styles.summarySub}>
              Applied before Stripe processing fees
            </div>
          </div>

          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Stripe payouts</div>
            <div
              style={enabledStyle(Boolean(formState.stripe_connect_account_id))}
            >
              {formState.stripe_connect_account_id ? "Started" : "Not started"}
            </div>
            <div style={styles.summarySub}>
              Tenant payout onboarding through Stripe Connect
            </div>
          </div>
        </div>
      </section>

      <section className="contentGrid" style={styles.contentGrid}>
        <form action={updateTenantBillingSettings} style={styles.formCard}>
          <div style={styles.cardHeader}>
            <div>
              <div style={styles.cardEyebrow}>Subscription setup</div>
              <h2 style={styles.cardTitle}>Tenant billing configuration</h2>
            </div>

            <div style={styles.liveBadge}>LIVE SETTINGS</div>
          </div>

          <div className="formGrid" style={styles.formGrid}>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Subscription tier</span>
              <select
                name="subscription_tier"
                defaultValue={formState.subscription_tier}
                style={styles.select}
              >
                <option value="community">Community — Free + 7%</option>
                <option value="professional">
                  Professional — £25/month + 4%
                </option>
                <option value="foundation">
                  Foundation — £99/month + 2%
                </option>
              </select>
            </label>

            <label style={styles.field}>
              <span style={styles.fieldLabel}>Platform fee percentage</span>
              <input
                type="number"
                name="platform_fee_percent"
                min="0"
                max="100"
                step="0.1"
                defaultValue={formState.platform_fee_percent}
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.fieldLabel}>Subscription status</span>
              <select
                name="subscription_status"
                defaultValue={formState.subscription_status}
                style={styles.select}
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
                defaultValue={formState.stripe_customer_id}
                placeholder="cus_xxxxxxxxx"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.fieldLabel}>Stripe subscription ID</span>
              <input
                type="text"
                name="stripe_subscription_id"
                defaultValue={formState.stripe_subscription_id}
                placeholder="sub_xxxxxxxxx"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.fieldLabel}>Stripe Connect account</span>
              <input
                type="text"
                name="stripe_connect_account_id"
                defaultValue={formState.stripe_connect_account_id}
                placeholder="acct_xxxxxxxxx"
                style={styles.input}
              />
            </label>
          </div>

          <div className="stripeConnectPanel" style={styles.stripeConnectPanel}>
            <div style={styles.stripeConnectCopy}>
              <div style={styles.stripeConnectKicker}>Stripe Connect</div>

              <h3 style={styles.stripeConnectTitle}>
                Tenant payout onboarding
              </h3>

              <p style={styles.stripeConnectText}>
                Create or continue Stripe-hosted onboarding so this tenant can
                later receive automatic payouts through their own connected
                Stripe account.
              </p>

              {formState.stripe_connect_account_id ? (
                <p style={styles.stripeConnectAccount}>
                  Connected account:{" "}
                  <strong>{formState.stripe_connect_account_id}</strong>
                </p>
              ) : null}
            </div>

            <Link
              href="/api/admin/stripe/connect/create"
              className="connectStripeButton"
              style={styles.connectStripeButton}
            >
              {formState.stripe_connect_account_id
                ? "Continue Stripe onboarding →"
                : "Connect Stripe →"}
            </Link>
          </div>

          <div style={styles.toggleSection}>
            <div>
              <div style={styles.toggleTitle}>Platform capabilities</div>
              <div style={styles.toggleText}>
                Enable or disable premium operational functionality for this
                tenant.
              </div>
            </div>

            <div className="toggleGrid" style={styles.toggleGrid}>
              <label style={styles.toggleCard}>
                <input
                  type="checkbox"
                  name="buyer_fee_contributions_enabled"
                  defaultChecked={formState.buyer_fee_contributions_enabled}
                />

                <div>
                  <div style={styles.toggleCardTitle}>Buyer contributions</div>
                  <div style={styles.toggleCardText}>
                    Allow optional supporter contribution toward processing
                    costs.
                  </div>
                </div>
              </label>

              {capabilities.map((item) => (
                <label key={item.key} style={styles.toggleCard}>
                  <input
                    type="checkbox"
                    name={item.key}
                    defaultChecked={item.enabled}
                  />

                  <div>
                    <div style={styles.toggleCardTitle}>{item.label}</div>
                    <div style={styles.toggleCardText}>
                      {enabledLabel(item.enabled)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="submitRow" style={styles.submitRow}>
            <button type="submit" style={styles.saveButton}>
              Save billing settings
            </button>
          </div>
        </form>

        <section style={styles.sideColumn}>
          <article style={styles.sideCard}>
            <div style={styles.cardEyebrow}>Subscription tiers</div>
            <h2 style={styles.cardTitle}>Platform positioning</h2>

            <div style={styles.tiersList}>
              {(
                Object.entries(TIER_DETAILS) as [
                  TierKey,
                  (typeof TIER_DETAILS)[TierKey],
                ][]
              ).map(([key, value]) => (
                <div
                  key={key}
                  style={key === tier ? styles.activeTierCard : styles.tierCard}
                >
                  <div style={styles.tierTop}>
                    <div>
                      <div style={styles.tierName}>{value.name}</div>
                      <div style={styles.tierPrice}>{value.monthly}</div>
                    </div>

                    <div style={styles.tierFee}>{value.fee}</div>
                  </div>

                  <p style={styles.tierDescription}>{value.description}</p>

                  <ul style={styles.featureList}>
                    {value.features.map((feature) => (
                      <li key={feature} style={styles.featureItem}>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </article>

          <article style={styles.sideCard}>
            <div style={styles.cardEyebrow}>Connect status</div>
            <h2 style={styles.cardTitle}>Stripe readiness</h2>

            <div style={styles.statusList}>
              <div className="statusRow" style={styles.statusRow}>
                <span>Connected account</span>
                <strong>
                  {formState.stripe_connect_account_id
                    ? "Created"
                    : "Not created"}
                </strong>
              </div>

              <div className="statusRow" style={styles.statusRow}>
                <span>Customer ID</span>
                <strong>{formState.stripe_customer_id ? "Saved" : "Not saved"}</strong>
              </div>

              <div className="statusRow" style={styles.statusRow}>
                <span>Subscription ID</span>
                <strong>
                  {formState.stripe_subscription_id ? "Saved" : "Not saved"}
                </strong>
              </div>
            </div>
          </article>

          <article style={styles.sideCard}>
            <div style={styles.cardEyebrow}>Important note</div>
            <h2 style={styles.cardTitle}>No payment routing changed yet</h2>

            <p style={styles.sideText}>
              Stripe Connect onboarding is now available, but checkout routing
              has not been changed. Current raffle, square, event and auction
              payments remain on the existing working flow until Connect is
              tested.
            </p>
          </article>
        </section>
      </section>
    </main>
  );
}

const responsiveStyles = `
.billing-page,
.billing-page * {
  box-sizing: border-box;
}

.billing-page {
  overflow-x: hidden;
}

.billing-page section,
.billing-page article,
.billing-page div,
.billing-page form,
.billing-page label {
  min-width: 0;
}

@media (max-width: 980px) {
  .billing-page .hero,
  .billing-page .contentGrid {
    grid-template-columns: 1fr !important;
  }

  .billing-page .heroSummaryGrid,
  .billing-page .formGrid,
  .billing-page .toggleGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .billing-page .stripeConnectPanel {
    grid-template-columns: 1fr !important;
  }

  .billing-page .connectStripeButton {
    width: fit-content !important;
  }
}

@media (max-width: 680px) {
  .billing-page {
    padding: 16px 10px 44px !important;
  }

  .billing-page .hero,
  .billing-page .formCard,
  .billing-page .sideCard {
    padding: 18px !important;
    border-radius: 24px !important;
  }

  .billing-page .title {
    font-size: clamp(36px, 12vw, 52px) !important;
    line-height: 0.98 !important;
  }

  .billing-page .heroActions,
  .billing-page .heroSummaryGrid,
  .billing-page .formGrid,
  .billing-page .toggleGrid,
  .billing-page .submitRow,
  .billing-page .stripeConnectPanel,
  .billing-page .statusRow,
  .billing-page .cardHeader,
  .billing-page .tierTop {
    grid-template-columns: 1fr !important;
  }

  .billing-page .heroButton,
  .billing-page .heroButtonLight,
  .billing-page .saveButton,
  .billing-page .connectStripeButton {
    width: 100% !important;
    justify-content: center !important;
    text-align: center !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1240,
    margin: "0 auto",
    padding: "28px 16px 64px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.10), transparent 34%), #f8fafc",
    color: "#0f172a",
    overflowX: "hidden",
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.85fr)",
    gap: 22,
    padding: 30,
    borderRadius: 34,
    background:
      "radial-gradient(circle at top left, rgba(251,191,36,0.22), transparent 32%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 28px 70px rgba(15,23,42,0.22)",
    overflow: "hidden",
  },
  heroContent: { minWidth: 0 },
  eyebrow: {
    display: "inline-flex",
    padding: "7px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "#bfdbfe",
    border: "1px solid rgba(255,255,255,0.16)",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 16,
  },
  title: {
    margin: 0,
    fontSize: "clamp(48px, 7vw, 74px)",
    lineHeight: 0.94,
    letterSpacing: "-0.075em",
    overflowWrap: "anywhere",
  },
  subtitle: {
    margin: "18px 0 0",
    maxWidth: 780,
    color: "#dbeafe",
    fontSize: 18,
    lineHeight: 1.6,
    fontWeight: 700,
  },
  tenantLine: {
    margin: "14px 0 0",
    color: "#bfdbfe",
    fontWeight: 850,
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
    background: "rgba(255,255,255,0.10)",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    border: "1px solid rgba(255,255,255,0.16)",
  },
  heroSummaryGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
    alignContent: "start",
  },
  summaryCard: {
    display: "grid",
    gap: 7,
    padding: 16,
    borderRadius: 22,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.16)",
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
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-0.055em",
    overflowWrap: "anywhere",
  },
  summarySub: {
    color: "#dbeafe",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.25fr) minmax(280px, 0.75fr)",
    gap: 16,
    alignItems: "start",
  },
  formCard: {
    display: "grid",
    gap: 18,
    padding: 22,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
  },
  cardHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "start",
  },
  cardEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 7,
  },
  cardTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 28,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },
  liveBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 10px",
    borderRadius: 999,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
    width: "fit-content",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  field: { display: "grid", gap: 7, minWidth: 0 },
  fieldLabel: { color: "#334155", fontSize: 13, fontWeight: 950 },
  input: {
    width: "100%",
    minWidth: 0,
    minHeight: 46,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "10px 12px",
    fontSize: 15,
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    minWidth: 0,
    minHeight: 46,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "10px 12px",
    fontSize: 15,
    boxSizing: "border-box",
  },
  stripeConnectPanel: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) max-content",
    gap: 14,
    alignItems: "center",
    padding: 16,
    borderRadius: 22,
    background:
      "linear-gradient(135deg, rgba(99,91,255,0.10), rgba(255,255,255,1))",
    border: "1px solid rgba(99,91,255,0.22)",
    minWidth: 0,
  },
  stripeConnectCopy: { minWidth: 0 },
  stripeConnectKicker: {
    color: "#635bff",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },
  stripeConnectTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },
  stripeConnectText: {
    margin: "7px 0 0",
    color: "#475569",
    lineHeight: 1.5,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },
  stripeConnectAccount: {
    margin: "8px 0 0",
    color: "#334155",
    fontSize: 13,
    fontWeight: 850,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },
  connectStripeButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    padding: "10px 15px",
    borderRadius: 999,
    background: "#635bff",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  toggleSection: { display: "grid", gap: 14, paddingTop: 4 },
  toggleTitle: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: "-0.035em",
  },
  toggleText: {
    marginTop: 5,
    color: "#64748b",
    lineHeight: 1.5,
    fontWeight: 700,
  },
  toggleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  toggleCard: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 10,
    alignItems: "start",
    padding: 13,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    cursor: "pointer",
    minWidth: 0,
  },
  toggleCardTitle: {
    color: "#0f172a",
    fontWeight: 950,
    overflowWrap: "anywhere",
  },
  toggleCardText: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.4,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },
  submitRow: {
    display: "grid",
    gridTemplateColumns: "max-content",
    justifyContent: "end",
  },
  saveButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    padding: "12px 18px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "1px solid #1683f8",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(22,131,248,0.18)",
  },
  sideColumn: { display: "grid", gap: 16, minWidth: 0 },
  sideCard: {
    display: "grid",
    gap: 14,
    padding: 20,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
  },
  tiersList: { display: "grid", gap: 12 },
  tierCard: {
    display: "grid",
    gap: 10,
    padding: 14,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  activeTierCard: {
    display: "grid",
    gap: 10,
    padding: 14,
    borderRadius: 20,
    background: "#eff6ff",
    border: "2px solid #1683f8",
    minWidth: 0,
  },
  tierTop: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 10,
    alignItems: "start",
  },
  tierName: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },
  tierPrice: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 13,
    fontWeight: 850,
  },
  tierFee: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 10px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#2563eb",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
    width: "fit-content",
  },
  tierDescription: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.45,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },
  featureList: {
    display: "grid",
    gap: 6,
    margin: 0,
    paddingLeft: 18,
    color: "#334155",
    fontSize: 13,
    lineHeight: 1.4,
    fontWeight: 750,
  },
  featureItem: { paddingLeft: 2 },
  sideText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.6,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },
  statusList: { display: "grid", gap: 9 },
  statusRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 10,
    padding: 11,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#334155",
    fontSize: 13,
    fontWeight: 800,
    minWidth: 0,
  },
  enabledPill: {
    display: "inline-flex",
    width: "fit-content",
    padding: "7px 10px",
    borderRadius: 999,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontSize: 12,
    fontWeight: 950,
  },
  disabledPill: {
    display: "inline-flex",
    width: "fit-content",
    padding: "7px 10px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#64748b",
    border: "1px solid #cbd5e1",
    fontSize: 12,
    fontWeight: 950,
  },
};
