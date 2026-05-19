"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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

type Props = {
  tenantSlug: string;
  formState: TenantSettingsFormState;
  connectStatus: TenantConnectStatus | null;
  updateAction: (formData: FormData) => Promise<void>;
};

const TIER_DETAILS: Record<
  TierKey,
  {
    name: string;
    monthly: string;
    fee: string;
    feeNumber: number;
    description: string;
    features: string[];
  }
> = {
  community: {
    name: "Community",
    monthly: "Free",
    fee: "7%",
    feeNumber: 7,
    description:
      "Accessible fundraising for smaller organisers and first campaigns.",
    features: [
      "Raffles",
      "Squares",
      "Events",
      "2 active campaigns",
      "Public campaign pages",
      "Optional supporter processing-cost contribution",
    ],
  },
  professional: {
    name: "Professional",
    monthly: "£25/month",
    fee: "3.5%",
    feeNumber: 3.5,
    description:
      "Premium fundraising tools for schools, clubs and growing charities.",
    features: [
      "Unlimited active campaigns",
      "Events",
      "Auctions",
      "CRM",
      "Finance dashboard",
      "Branding controls",
      "Custom commission",
      "Customer exports",
    ],
  },
  foundation: {
    name: "Foundation",
    monthly: "£99/month",
    fee: "1.5%",
    feeNumber: 1.5,
    description:
      "Advanced operating infrastructure for larger fundraising organisations.",
    features: [
      "Unlimited active campaigns",
      "Lowest platform fee",
      "Advanced reporting",
      "Stripe Connect ready",
      "Custom commission",
      "Priority support",
      "White-label direction",
      "Large-scale operations",
      "Custom domain direction",
    ],
  },
};

function enabledLabel(value: boolean) {
  return value ? "Enabled" : "Not included";
}

function completeLabel(value: boolean) {
  return value ? "Complete" : "Incomplete";
}

function savedLabel(value: boolean) {
  return value ? "Saved" : "Not saved";
}

function enabledStyle(value: boolean): CSSProperties {
  return value ? styles.enabledPill : styles.disabledPill;
}

function formatSyncDate(value: string | null | undefined) {
  if (!value) return "Not synced yet";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not synced yet";

  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0.0%";

  return `${Number(value).toLocaleString("en-GB", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })}%`;
}

function displayValue(value: string | null | undefined, fallback = "Not set") {
  const clean = String(value || "").trim();

  return clean || fallback;
}

function tierCapabilityEnabled(tier: TierKey, key: string) {
  if (key === "crm_enabled") return tier !== "community";
  if (key === "auctions_enabled") return tier !== "community";
  if (key === "reserved_seating_enabled") return tier !== "community";
  if (key === "finance_dashboard_enabled") return tier !== "community";
  if (key === "white_label_enabled") return tier === "foundation";
  if (key === "custom_domain_enabled") return tier === "foundation";
  return false;
}

function getConnectMessage(value: string | null) {
  if (value === "returned") {
    return {
      tone: "success" as const,
      title: "Returned from Stripe",
      text: "Stripe returned you to billing. Sync the Stripe status to refresh charges, payouts and onboarding readiness.",
    };
  }

  if (value === "return") {
    return {
      tone: "success" as const,
      title: "Stripe onboarding returned",
      text: "You returned from the Stripe onboarding flow. Sync the Stripe status to refresh this page.",
    };
  }

  if (value === "missing_secret") {
    return {
      tone: "error" as const,
      title: "Stripe secret key missing",
      text: "Stripe Connect cannot start until STRIPE_SECRET_KEY is configured in Vercel.",
    };
  }

  if (value === "failed") {
    return {
      tone: "error" as const,
      title: "Stripe onboarding failed",
      text: "Stripe could not create or continue the onboarding session. Check Vercel logs and Stripe configuration.",
    };
  }

  if (value === "refresh_failed") {
    return {
      tone: "error" as const,
      title: "Stripe onboarding refresh failed",
      text: "Stripe could not create a fresh onboarding link. Try syncing the account status, then continue onboarding again.",
    };
  }

  return null;
}

function getStatusMessage(value: string | null) {
  if (value === "refreshed") {
    return {
      tone: "success" as const,
      title: "Stripe status synced",
      text: "The latest Stripe Connect status has been saved to this tenant.",
    };
  }

  if (value === "missing") {
    return {
      tone: "warning" as const,
      title: "No Stripe Connect account found",
      text: "Start Stripe onboarding to create this tenant’s payout account.",
    };
  }

  if (value === "missing_secret") {
    return {
      tone: "error" as const,
      title: "Stripe secret key missing",
      text: "Stripe status cannot sync until STRIPE_SECRET_KEY is configured in Vercel.",
    };
  }

  if (value === "failed") {
    return {
      tone: "error" as const,
      title: "Stripe status sync failed",
      text: "Stripe could not refresh this tenant’s Connect status. Check the account ID and Vercel logs.",
    };
  }

  return null;
}

function StatusMessage({
  message,
}: {
  message: {
    tone: "success" | "warning" | "error";
    title: string;
    text: string;
  } | null;
}) {
  if (!message) return null;

  const style =
    message.tone === "success"
      ? styles.messageSuccess
      : message.tone === "warning"
        ? styles.messageWarning
        : styles.messageError;

  return (
    <section className="billing-message" style={style}>
      <strong style={styles.messageTitle}>{message.title}</strong>
      <span style={styles.messageText}>{message.text}</span>
    </section>
  );
}

export default function BillingSettingsForm({
  tenantSlug,
  formState,
  connectStatus,
  updateAction,
}: Props) {
  const searchParams = useSearchParams();

  const tier = formState.subscription_tier;
  const [buyerContributions, setBuyerContributions] = useState(
    formState.buyer_fee_contributions_enabled,
  );

  const currentTier = TIER_DETAILS[tier];
  const displayedPlatformFeePercent = Number.isFinite(
    Number(formState.platform_fee_percent),
  )
    ? Number(formState.platform_fee_percent)
    : currentTier.feeNumber;

  const connectAccountId =
    formState.stripe_connect_account_id ||
    connectStatus?.stripe_connect_account_id ||
    "";

  const hasConnectAccount = Boolean(connectAccountId);
  const onboardingComplete = Boolean(
    connectStatus?.stripe_connect_onboarding_complete,
  );
  const chargesEnabled = Boolean(connectStatus?.stripe_connect_charges_enabled);
  const payoutsEnabled = Boolean(connectStatus?.stripe_connect_payouts_enabled);
  const detailsSubmitted = Boolean(
    connectStatus?.stripe_connect_details_submitted,
  );

  const readyForLivePayments =
    hasConnectAccount && onboardingComplete && chargesEnabled && payoutsEnabled;

  const connectMessage = getConnectMessage(searchParams.get("stripe_connect"));
  const statusMessage = getStatusMessage(searchParams.get("stripe_status"));

  const readinessText = readyForLivePayments
    ? "Ready for live payments and payouts"
    : hasConnectAccount
      ? "Stripe account started — complete onboarding and sync status"
      : "Stripe Connect not started";
    const capabilities = useMemo(
    () => [
      {
        label: "CRM",
        key: "crm_enabled" as const,
        enabled:
          Boolean(formState.crm_enabled) ||
          tierCapabilityEnabled(tier, "crm_enabled"),
      },
      {
        label: "Auctions",
        key: "auctions_enabled" as const,
        enabled:
          Boolean(formState.auctions_enabled) ||
          tierCapabilityEnabled(tier, "auctions_enabled"),
      },
      {
        label: "Reserved seating",
        key: "reserved_seating_enabled" as const,
        enabled:
          Boolean(formState.reserved_seating_enabled) ||
          tierCapabilityEnabled(tier, "reserved_seating_enabled"),
      },
      {
        label: "Finance dashboard",
        key: "finance_dashboard_enabled" as const,
        enabled:
          Boolean(formState.finance_dashboard_enabled) ||
          tierCapabilityEnabled(tier, "finance_dashboard_enabled"),
      },
      {
        label: "White label",
        key: "white_label_enabled" as const,
        enabled:
          Boolean(formState.white_label_enabled) ||
          tierCapabilityEnabled(tier, "white_label_enabled"),
      },
      {
        label: "Custom domain",
        key: "custom_domain_enabled" as const,
        enabled:
          Boolean(formState.custom_domain_enabled) ||
          tierCapabilityEnabled(tier, "custom_domain_enabled"),
      },
    ],
    [formState, tier],
  );

  return (
    <main className="billing-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <StatusMessage message={connectMessage} />
      <StatusMessage message={statusMessage} />

      <section className="hero" style={styles.hero}>
        <div style={styles.heroGlow} />

        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Tenant billing</div>

          <h1 className="so-brand-heading title" style={styles.title}>
            Billing & subscription
          </h1>

          <p style={styles.subtitle}>
            View this tenant’s plan, platform commission, Stripe readiness and
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
              {currentTier.monthly} · {currentTier.fee} minimum platform fee
            </div>
          </div>

          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Platform commission</div>
            <div style={styles.summaryValue}>
              {formatPercent(displayedPlatformFeePercent)}
            </div>
            <div style={styles.summarySub}>
              Managed by platform billing controls.
            </div>
          </div>

          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Stripe payouts</div>
            <div style={enabledStyle(hasConnectAccount)}>
              {readyForLivePayments
                ? "Ready"
                : hasConnectAccount
                  ? "Started"
                  : "Not started"}
            </div>
            <div style={styles.summarySub}>{readinessText}</div>
          </div>
        </div>
      </section>

      <section className="stripeActionPanel" style={styles.stripeActionPanel}>
        <div style={styles.stripeActionContent}>
          <div style={styles.cardEyebrow}>Stripe Connect</div>

          <h2 style={styles.cardTitle}>Tenant payout readiness</h2>

          <p style={styles.stripeActionText}>
            Connect this tenant to Stripe so ticket, raffle and squares payments
            can be routed to the tenant account with platform commission handled
            separately.
          </p>

          <div className="readinessGrid" style={styles.readinessGrid}>
            <ReadinessItem label="Account" ready={hasConnectAccount} />
            <ReadinessItem label="Onboarding" ready={onboardingComplete} />
            <ReadinessItem label="Charges" ready={chargesEnabled} />
            <ReadinessItem label="Payouts" ready={payoutsEnabled} />
          </div>
        </div>

        <div className="stripeActionButtons" style={styles.stripeActionButtons}>
          <a
            href="/api/admin/stripe/connect/onboard"
            style={styles.connectPrimaryButton}
          >
            {hasConnectAccount ? "Continue onboarding" : "Start onboarding"}
          </a>

          <a
            href="/api/stripe/connect/refresh"
            style={styles.connectSecondaryButton}
          >
            Refresh onboarding link
          </a>

          <a
            href="/api/stripe/connect/status"
            style={styles.connectSecondaryButton}
          >
            Sync Stripe status
          </a>
        </div>
      </section>

      <section className="contentGrid" style={styles.contentGrid}>
        <form action={updateAction} style={styles.formCard}>
          <div style={styles.cardHeader}>
            <div>
              <div style={styles.cardEyebrow}>Subscription setup</div>
              <h2 style={styles.cardTitle}>Tenant billing configuration</h2>
            </div>

            <div style={styles.liveBadge}>VIEW SETTINGS</div>
          </div>

          <div className="formGrid" style={styles.formGrid}>
            <ReadOnlyField
              label="Subscription tier"
              value={`${currentTier.name} — ${currentTier.monthly}`}
              helper="Plan changes are managed through platform billing controls."
            />

            <ReadOnlyField
              label="Platform fee percentage"
              value={formatPercent(displayedPlatformFeePercent)}
              helper={`Current plan minimum is ${currentTier.fee}.`}
            />

            <ReadOnlyField
              label="Subscription status"
              value={displayValue(formState.subscription_status, "Active")}
              helper="Subscription status is controlled by billing records."
            />

            <ReadOnlyField
              label="Stripe customer ID"
              value={displayValue(formState.stripe_customer_id)}
              helper="Linked Stripe billing customer."
            />

            <ReadOnlyField
              label="Stripe subscription ID"
              value={displayValue(formState.stripe_subscription_id)}
              helper="Linked Stripe subscription record."
            />

            <ReadOnlyField
              label="Stripe Connect account"
              value={displayValue(connectAccountId)}
              helper="Tenant payout account for Stripe Connect."
            />
          </div>

          <div className="toggleGrid" style={styles.toggleGrid}>
            <label style={styles.toggleCard}>
              <input
                type="checkbox"
                name="buyer_fee_contributions_enabled"
                checked={buyerContributions}
                onChange={(event) => setBuyerContributions(event.target.checked)}
              />

              <div>
                <div style={styles.toggleCardTitle}>Buyer contributions</div>
                <div style={styles.toggleCardText}>
                  Allow optional supporter contribution toward processing costs.
                </div>
              </div>
            </label>
                        {capabilities.map((item) => (
              <div key={item.key} style={styles.readOnlyToggleCard}>
                <span
                  style={{
                    ...styles.statusDot,
                    ...(item.enabled ? styles.statusDotOn : styles.statusDotOff),
                  }}
                />

                <div>
                  <div style={styles.toggleCardTitle}>{item.label}</div>
                  <div style={styles.toggleCardText}>
                    {enabledLabel(item.enabled)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="submitRow" style={styles.submitRow}>
            <button type="submit" style={styles.saveButton}>
              Save contribution setting
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
                <strong>{hasConnectAccount ? "Created" : "Not created"}</strong>
              </div>

              <div className="statusRow" style={styles.statusRow}>
                <span>Onboarding</span>
                <strong>{completeLabel(onboardingComplete)}</strong>
              </div>

              <div className="statusRow" style={styles.statusRow}>
                <span>Charges</span>
                <strong>{enabledLabel(chargesEnabled)}</strong>
              </div>

              <div className="statusRow" style={styles.statusRow}>
                <span>Payouts</span>
                <strong>{enabledLabel(payoutsEnabled)}</strong>
              </div>

              <div className="statusRow" style={styles.statusRow}>
                <span>Details submitted</span>
                <strong>{savedLabel(detailsSubmitted)}</strong>
              </div>

              <div className="statusRow" style={styles.statusRow}>
                <span>Country</span>
                <strong>
                  {connectStatus?.stripe_connect_country || "Not synced"}
                </strong>
              </div>

              <div className="statusRow" style={styles.statusRow}>
                <span>Currency</span>
                <strong>
                  {(
                    connectStatus?.stripe_connect_default_currency ||
                    "Not synced"
                  ).toUpperCase()}
                </strong>
              </div>

              <div className="statusRow" style={styles.statusRow}>
                <span>Last synced</span>
                <strong>
                  {formatSyncDate(
                    connectStatus?.stripe_connect_last_synced_at,
                  )}
                </strong>
              </div>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}

function ReadOnlyField({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div style={styles.readOnlyField}>
      <span style={styles.fieldLabel}>{label}</span>
      <strong style={styles.readOnlyValue}>{value}</strong>
      <span style={styles.helperTextMuted}>{helper}</span>
    </div>
  );
}

function ReadinessItem({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div style={styles.readinessItem}>
      <span
        style={{
          ...styles.statusDot,
          ...(ready ? styles.statusDotOn : styles.statusDotOff),
        }}
      />

      <div>
        <strong style={styles.readinessLabel}>{label}</strong>
        <span style={styles.readinessText}>
          {ready ? "Ready" : "Needs attention"}
        </span>
      </div>
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
.billing-page article,
.billing-page div,
.billing-page form,
.billing-page label {
  min-width: 0;
}

@media (max-width: 980px) {
  .billing-page .hero,
  .billing-page .contentGrid,
  .billing-page .stripeActionPanel {
    grid-template-columns: 1fr !important;
  }

  .billing-page .heroSummaryGrid,
  .billing-page .formGrid,
  .billing-page .toggleGrid,
  .billing-page .readinessGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 680px) {
  .billing-page {
    padding: 16px 10px 44px !important;
  }

  .billing-page .hero,
  .billing-page .formCard,
  .billing-page .sideCard,
  .billing-page .stripeActionPanel {
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
  .billing-page .readinessGrid,
  .billing-page .stripeActionButtons,
  .billing-page .submitRow,
  .billing-page .statusRow,
  .billing-page .cardHeader,
  .billing-page .tierTop {
    grid-template-columns: 1fr !important;
  }

  .billing-page .heroButton,
  .billing-page .heroButtonLight,
  .billing-page .saveButton,
  .billing-page .connectPrimaryButton,
  .billing-page .connectSecondaryButton {
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
      "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 32%), radial-gradient(circle at top right, rgba(15,23,42,0.05), transparent 34%), #f8fafc",
    color: "#0f172a",
    overflowX: "hidden",
  },
  messageSuccess: {
    display: "grid",
    gap: 5,
    marginBottom: 14,
    padding: "14px 16px",
    borderRadius: 18,
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#166534",
  },
  messageWarning: {
    display: "grid",
    gap: 5,
    marginBottom: 14,
    padding: "14px 16px",
    borderRadius: 18,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
  },
  messageError: {
    display: "grid",
    gap: 5,
    marginBottom: 14,
    padding: "14px 16px",
    borderRadius: 18,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
  },
  messageTitle: {
    fontSize: 14,
    fontWeight: 950,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 750,
  },
  hero: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.85fr)",
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
    gridTemplateColumns: "1fr",
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
  stripeActionPanel: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 0.45fr)",
    gap: 16,
    alignItems: "center",
    padding: 22,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 54%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    boxShadow: "0 12px 34px rgba(15,23,42,0.055)",
    marginBottom: 18,
    minWidth: 0,
  },
  stripeActionContent: {
    minWidth: 0,
  },
  stripeActionText: {
    margin: "8px 0 0",
    color: "#475569",
    fontSize: 15,
    lineHeight: 1.55,
    fontWeight: 750,
    maxWidth: 820,
  },
  readinessGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    marginTop: 16,
  },
  readinessItem: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 10,
    alignItems: "start",
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  readinessLabel: {
    display: "block",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },
  readinessText: {
    display: "block",
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.35,
  },
  stripeActionButtons: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 10,
    minWidth: 0,
  },
  connectPrimaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    padding: "12px 16px",
    borderRadius: 999,
    background: "linear-gradient(135deg, #1683f8 0%, #2563eb 100%)",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    boxShadow: "0 14px 28px rgba(22,131,248,0.22)",
    textAlign: "center",
  },
  connectSecondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    padding: "12px 16px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 950,
    border: "1px solid #cbd5e1",
    textAlign: "center",
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
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
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
  fieldLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
  },
  readOnlyField: {
    display: "grid",
    gap: 7,
    minWidth: 0,
    padding: 13,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  readOnlyValue: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },
  helperTextMuted: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
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
  readOnlyToggleCard: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 10,
    alignItems: "start",
    padding: 13,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    marginTop: 4,
    display: "inline-flex",
    flexShrink: 0,
  },
  statusDotOn: {
    background: "#16a34a",
    boxShadow: "0 0 0 4px rgba(22,163,74,0.12)",
  },
  statusDotOff: {
    background: "#94a3b8",
    boxShadow: "0 0 0 4px rgba(148,163,184,0.14)",
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
  },
  sideColumn: {
    display: "grid",
    gap: 16,
    minWidth: 0,
  },
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
  tiersList: {
    display: "grid",
    gap: 12,
  },
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
  featureItem: {
    paddingLeft: 2,
  },
  statusList: {
    display: "grid",
    gap: 9,
  },
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
