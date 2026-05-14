import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TierKey = "community" | "professional" | "foundation";

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
    description: "Accessible fundraising for smaller organisers and first campaigns.",
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
    description: "Premium fundraising tools for schools, clubs and growing charities.",
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
    description: "Advanced operating infrastructure for larger fundraising organisations.",
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

function safePercent(value: unknown, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return number;
}

function enabledLabel(value: boolean) {
  return value ? "Enabled" : "Not enabled";
}

function enabledStyle(value: boolean): CSSProperties {
  return value ? styles.enabledPill : styles.disabledPill;
}

export default async function AdminBillingSettingsPage() {
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

  const settings = await getTenantSettings(tenantSlug);

  const tier = safeTier(settings?.subscription_tier);
  const currentTier = TIER_DETAILS[tier];
  const platformFeePercent = safePercent(
    settings?.platform_fee_percent,
    tier === "foundation" ? 2 : tier === "professional" ? 4 : 7,
  );

  const capabilities = [
    { label: "CRM", enabled: Boolean(settings?.crm_enabled) || tier !== "community" },
    {
      label: "Auctions",
      enabled: Boolean(settings?.auctions_enabled) || tier !== "community",
    },
    {
      label: "Reserved seating",
      enabled:
        Boolean(settings?.reserved_seating_enabled) || tier !== "community",
    },
    {
      label: "Finance dashboard",
      enabled:
        Boolean(settings?.finance_dashboard_enabled) || tier !== "community",
    },
    {
      label: "White label",
      enabled: Boolean(settings?.white_label_enabled) || tier === "foundation",
    },
    {
      label: "Custom domain",
      enabled:
        Boolean(settings?.custom_domain_enabled) || tier === "foundation",
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
            View this tenant’s plan, platform commission, billing status and
            commercial feature settings.
          </p>

          <p style={styles.tenantLine}>
            Tenant: <strong>{tenantSlug}</strong>
          </p>

          <div className="heroActions" style={styles.heroActions}>
            <Link href="/admin" style={styles.heroButton}>
              ← Back to dashboard
            </Link>

            <Link href="/admin/metadata" style={styles.heroButtonLight}>
              Finance dashboard
            </Link>
          </div>
        </div>

        <div style={styles.currentPlanCard}>
          <span style={styles.planBadge}>Current plan</span>

          <h2 style={styles.currentPlanTitle}>{currentTier.name}</h2>

          <div style={styles.priceLine}>{currentTier.monthly}</div>

          <p style={styles.planText}>
            {platformFeePercent.toFixed(2).replace(".00", "")}% platform fee
          </p>

          <p style={styles.planMuted}>
            Stripe processing fees are handled separately. Supporter processing
            contribution remains optional.
          </p>
        </div>
      </section>

      <section className="summaryGrid" style={styles.summaryGrid}>
        <SummaryCard label="Subscription tier" value={currentTier.name} />
        <SummaryCard
          label="Platform fee"
          value={`${platformFeePercent.toFixed(2).replace(".00", "")}%`}
        />
        <SummaryCard
          label="Subscription status"
          value={settings?.subscription_status || "active"}
        />
        <SummaryCard
          label="Supporter contribution"
          value={
            settings?.buyer_fee_contributions_enabled
              ? "Available"
              : "Unavailable"
          }
        />
      </section>

      <section className="contentGrid" style={styles.contentGrid}>
        <section style={styles.panel}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.kicker}>Commercial setup</p>

              <h2 className="so-brand-card-title" style={styles.sectionTitle}>
                Plan details
              </h2>

              <p style={styles.sectionText}>
                These values come from the new tenant settings layer. This page
                is currently read-only while the billing system is being wired
                safely.
              </p>
            </div>
          </div>

          <div style={styles.detailList}>
            <DetailRow label="Tenant slug" value={tenantSlug} />
            <DetailRow label="Plan" value={currentTier.name} />
            <DetailRow
              label="Platform commission"
              value={`${platformFeePercent.toFixed(2).replace(".00", "")}%`}
            />
            <DetailRow
              label="Stripe customer ID"
              value={settings?.stripe_customer_id || "Not linked yet"}
            />
            <DetailRow
              label="Stripe subscription ID"
              value={settings?.stripe_subscription_id || "Not linked yet"}
            />
            <DetailRow
              label="Stripe Connect account"
              value={settings?.stripe_connect_account_id || "Not connected yet"}
            />
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.kicker}>Capabilities</p>

              <h2 className="so-brand-card-title" style={styles.sectionTitle}>
                Feature access
              </h2>

              <p style={styles.sectionText}>
                Feature gating is not being enforced yet. This shows how the
                tenant’s plan will map to platform capabilities.
              </p>
            </div>
          </div>

          <div style={styles.capabilityGrid}>
            {capabilities.map((capability) => (
              <div key={capability.label} style={styles.capabilityCard}>
                <span style={styles.capabilityLabel}>{capability.label}</span>

                <span style={enabledStyle(capability.enabled)}>
                  {enabledLabel(capability.enabled)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section style={styles.plansPanel}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.kicker}>Upgrade path</p>

            <h2 className="so-brand-card-title" style={styles.sectionTitle}>
              Subscription options
            </h2>

            <p style={styles.sectionText}>
              These cards are informational for now. Stripe subscription actions
              can be connected after the finance and fee logic is confirmed.
            </p>
          </div>
        </div>

        <div className="plansGrid" style={styles.plansGrid}>
          {(Object.keys(TIER_DETAILS) as TierKey[]).map((key) => {
            const plan = TIER_DETAILS[key];
            const isCurrent = key === tier;

            return (
              <article
                key={key}
                style={{
                  ...styles.planCard,
                  ...(isCurrent ? styles.currentPlanOutline : {}),
                }}
              >
                <div>
                  <span style={isCurrent ? styles.currentMiniBadge : styles.miniBadge}>
                    {isCurrent ? "Current plan" : "Available plan"}
                  </span>

                  <h3 style={styles.planTitle}>{plan.name}</h3>

                  <div style={styles.planPrice}>{plan.monthly}</div>

                  <p style={styles.planFee}>{plan.fee} platform fee</p>

                  <p style={styles.planDescription}>{plan.description}</p>
                </div>

                <ul style={styles.featureList}>
                  {plan.features.map((feature) => (
                    <li key={feature} style={styles.featureItem}>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button type="button" disabled style={styles.disabledButton}>
                  {isCurrent ? "Current plan" : "Upgrade coming soon"}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.summaryCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.detailRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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
.billing-page div,
.billing-page article {
  min-width: 0;
}

@media (max-width: 980px) {
  .billing-page .hero,
  .billing-page .contentGrid {
    grid-template-columns: 1fr !important;
  }

  .billing-page .summaryGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 680px) {
  .billing-page {
    padding: 16px 10px 44px !important;
  }

  .billing-page .hero {
    padding: 20px !important;
    border-radius: 26px !important;
  }

  .billing-page .title {
    font-size: clamp(36px, 12vw, 52px) !important;
    line-height: 0.98 !important;
  }

  .billing-page .heroActions,
  .billing-page .summaryGrid,
  .billing-page .plansGrid,
  .billing-page .capabilityGrid {
    grid-template-columns: 1fr !important;
  }

  .billing-page .heroButton,
  .billing-page .heroButtonLight {
    width: 100% !important;
    justify-content: center !important;
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
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(300px, 0.8fr)",
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
  heroContent: {
    minWidth: 0,
  },
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
  currentPlanCard: {
    display: "grid",
    gap: 10,
    alignContent: "start",
    padding: 20,
    borderRadius: 26,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.18)",
    backdropFilter: "blur(12px)",
  },
  planBadge: {
    width: "fit-content",
    padding: "7px 11px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
  },
  currentPlanTitle: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1,
    letterSpacing: "-0.055em",
  },
  priceLine: {
    fontSize: 30,
    fontWeight: 950,
    color: "#fef3c7",
    letterSpacing: "-0.055em",
  },
  planText: {
    margin: 0,
    color: "#ffffff",
    fontWeight: 950,
  },
  planMuted: {
    margin: 0,
    color: "#dbeafe",
    lineHeight: 1.55,
    fontWeight: 700,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 18,
  },
  summaryCard: {
    display: "grid",
    gap: 5,
    padding: 16,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    overflowWrap: "anywhere",
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: 16,
    marginBottom: 18,
  },
  panel: {
    padding: 20,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  sectionHeader: {
    marginBottom: 16,
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
    fontSize: 28,
    letterSpacing: "-0.05em",
  },
  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 700,
  },
  detailList: {
    display: "grid",
    gap: 10,
  },
  detailRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.7fr) minmax(0, 1.3fr)",
    gap: 12,
    padding: 13,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    overflowWrap: "anywhere",
  },
  capabilityGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  capabilityCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    padding: 13,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    flexWrap: "wrap",
  },
  capabilityLabel: {
    fontWeight: 950,
    color: "#0f172a",
  },
  enabledPill: {
    display: "inline-flex",
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
    padding: "7px 10px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#64748b",
    border: "1px solid #cbd5e1",
    fontSize: 12,
    fontWeight: 950,
  },
  plansPanel: {
    padding: 20,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  plansGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
  },
  planCard: {
    display: "grid",
    gap: 14,
    padding: 18,
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    alignContent: "space-between",
  },
  currentPlanOutline: {
    border: "2px solid #1683f8",
    background: "#eff6ff",
  },
  miniBadge: {
    display: "inline-flex",
    width: "fit-content",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 950,
  },
  currentMiniBadge: {
    display: "inline-flex",
    width: "fit-content",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "1px solid #1683f8",
    fontSize: 12,
    fontWeight: 950,
  },
  planTitle: {
    margin: "12px 0 0",
    color: "#0f172a",
    fontSize: 25,
    letterSpacing: "-0.045em",
  },
  planPrice: {
    marginTop: 8,
    color: "#0f172a",
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },
  planFee: {
    margin: "5px 0 0",
    color: "#2563eb",
    fontWeight: 950,
  },
  planDescription: {
    margin: "9px 0 0",
    color: "#64748b",
    lineHeight: 1.5,
    fontWeight: 700,
  },
  featureList: {
    display: "grid",
    gap: 7,
    margin: 0,
    paddingLeft: 18,
    color: "#334155",
    fontWeight: 750,
    lineHeight: 1.45,
  },
  featureItem: {
    paddingLeft: 2,
  },
  disabledButton: {
    minHeight: 44,
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#64748b",
    fontWeight: 950,
    cursor: "not-allowed",
  },
};
