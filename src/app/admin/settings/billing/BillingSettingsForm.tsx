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
  platform_owner_bypass: boolean;
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
  isPlatformOwner: boolean;
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
  isPlatformOwner,
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

  const connectMessage = getConnectMessage(
    searchParams?.get("stripe_connect") ?? null,
  );

  const statusMessage = getStatusMessage(
    searchParams?.get("stripe_status") ?? null,
  );

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
          tierCapabilityEnabled(tier, "crm_enabled") ||
          Boolean(formState.platform_owner_bypass),
      },
      {
        label: "Auctions",
        key: "auctions_enabled" as const,
        enabled:
          Boolean(formState.auctions_enabled) ||
          tierCapabilityEnabled(tier, "auctions_enabled") ||
          Boolean(formState.platform_owner_bypass),
      },
      {
        label: "Reserved seating",
        key: "reserved_seating_enabled" as const,
        enabled:
          Boolean(formState.reserved_seating_enabled) ||
          tierCapabilityEnabled(tier, "reserved_seating_enabled") ||
          Boolean(formState.platform_owner_bypass),
      },
      {
        label: "Finance dashboard",
        key: "finance_dashboard_enabled" as const,
        enabled:
          Boolean(formState.finance_dashboard_enabled) ||
          tierCapabilityEnabled(tier, "finance_dashboard_enabled") ||
          Boolean(formState.platform_owner_bypass),
      },
      {
        label: "White label",
        key: "white_label_enabled" as const,
        enabled:
          Boolean(formState.white_label_enabled) ||
          tierCapabilityEnabled(tier, "white_label_enabled") ||
          Boolean(formState.platform_owner_bypass),
      },
      {
        label: "Custom domain",
        key: "custom_domain_enabled" as const,
        enabled:
          Boolean(formState.custom_domain_enabled) ||
          tierCapabilityEnabled(tier, "custom_domain_enabled") ||
          Boolean(formState.platform_owner_bypass),
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

        <div className="heroMainGrid" style={styles.heroMainGrid}>
          <div style={styles.heroContent}>
            <div style={styles.eyebrow}>Tenant billing</div>

            <h1 className="so-brand-heading title" style={styles.title}>
              Billing & subscription
            </h1>

            <p style={styles.subtitle}>
              View this tenant’s plan, platform commission, Stripe payout
              readiness and commercial feature settings.
            </p>

            <p style={styles.tenantLine}>
              Tenant: <strong>{tenantSlug}</strong>
            </p>

            <div className="heroStats" style={styles.heroStats}>
              <HeroStat label="Current plan" value={currentTier.name} />

              <HeroStat
                label="Platform fee"
                value={formatPercent(displayedPlatformFeePercent)}
              />

              <HeroStat
                label="Stripe payouts"
                value={
                  readyForLivePayments
                    ? "Ready"
                    : hasConnectAccount
                      ? "Started"
                      : "Not started"
                }
              />

              <HeroStat
                label="Contribution option"
                value={buyerContributions ? "Enabled" : "Off"}
              />
            </div>
          </div>

          <aside className="heroPanel" style={styles.heroPanel}>
            <div style={styles.heroPanelTitle}>Billing overview</div>

            <p style={styles.heroPanelText}>
              {currentTier.monthly} · {currentTier.fee} minimum platform fee.
              {formState.platform_owner_bypass
                ? " Owner bypass is enabled for this tenant."
                : " Commercial settings are managed by the platform owner."}
            </p>

            <div className="heroPanelGrid" style={styles.heroPanelGrid}>
              <MiniMetric
                label="Plan"
                value={`${currentTier.name} · ${currentTier.monthly}`}
              />

              <MiniMetric
                label="Commission"
                value={formatPercent(displayedPlatformFeePercent)}
              />

              <MiniMetric
                label="Stripe status"
                value={
                  readyForLivePayments
                    ? "Ready"
                    : hasConnectAccount
                      ? "Started"
                      : "Not started"
                }
              />

              <MiniMetric label="Tenant" value={tenantSlug} />
            </div>
          </aside>
        </div>

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
      </section>

      <section className="stripeActionPanel" style={styles.stripeActionPanel}>
        <div style={styles.stripeActionContent}>
          <div style={styles.cardEyebrow}>Stripe Connect</div>

          <h2 style={styles.cardTitle}>Tenant payout readiness</h2>

          <p style={styles.stripeActionText}>
            Connect this tenant to Stripe so campaign payments can be routed to
            the tenant account while platform commission remains tracked
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

            <div style={styles.liveBadge}>
              {isPlatformOwner ? "OWNER CONTROLS" : "VIEW SETTINGS"}
            </div>
          </div>

          {isPlatformOwner ? (
            <section style={styles.ownerPanel}>
              <div>
                <div style={styles.ownerPanelEyebrow}>Platform owner only</div>

                <h3 style={styles.ownerPanelTitle}>
                  Commercial controls for this tenant
                </h3>

                <p style={styles.ownerPanelText}>
                  These controls are only available to the platform owner. Normal
                  tenant admins can still manage their supporter contribution
                  setting, but cannot self-upgrade tiers, reduce platform fees or
                  enable premium features.
                </p>
              </div>

              <div className="formGrid" style={styles.formGrid}>
                <label style={styles.inputField}>
                  <span style={styles.fieldLabel}>Subscription tier</span>

                  <select
                    name="subscription_tier"
                    defaultValue={formState.subscription_tier}
                    style={styles.selectInput}
                  >
                    <option value="community">Community</option>
                    <option value="professional">Professional</option>
                    <option value="foundation">Foundation</option>
                  </select>

                  <span style={styles.helperTextMuted}>
                    Controls tier labels and default capability expectations.
                  </span>
                </label>

                <label style={styles.inputField}>
                  <span style={styles.fieldLabel}>Platform fee percentage</span>

                  <input
                    name="platform_fee_percent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    defaultValue={formState.platform_fee_percent}
                    style={styles.textInput}
                  />

                  <span style={styles.helperTextMuted}>
                    Used by checkout finance calculations for platform
                    commission.
                  </span>
                </label>

                <label style={styles.inputField}>
                  <span style={styles.fieldLabel}>Subscription status</span>

                  <input
                    name="subscription_status"
                    defaultValue={formState.subscription_status}
                    placeholder="active"
                    style={styles.textInput}
                  />

                  <span style={styles.helperTextMuted}>
                    Examples: active, trialing, manual, free, exempt.
                  </span>
                </label>

                <label style={styles.inputField}>
                  <span style={styles.fieldLabel}>Stripe customer ID</span>

                  <input
                    name="stripe_customer_id"
                    defaultValue={formState.stripe_customer_id}
                    placeholder="cus_..."
                    style={styles.textInput}
                  />

                  <span style={styles.helperTextMuted}>
                    Optional Stripe billing customer record.
                  </span>
                </label>

                <label style={styles.inputField}>
                  <span style={styles.fieldLabel}>Stripe subscription ID</span>

                  <input
                    name="stripe_subscription_id"
                    defaultValue={formState.stripe_subscription_id}
                    placeholder="sub_..."
                    style={styles.textInput}
                  />

                  <span style={styles.helperTextMuted}>
                    Optional Stripe subscription record.
                  </span>
                </label>

                <label style={styles.inputField}>
                  <span style={styles.fieldLabel}>Stripe Connect account</span>

                  <input
                    name="stripe_connect_account_id"
                    defaultValue={connectAccountId}
                    placeholder="acct_..."
                    style={styles.textInput}
                  />

                  <span style={styles.helperTextMuted}>
                    Usually created through Stripe Connect onboarding.
                  </span>
                </label>
              </div>
            </section>
          ) : (
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
          )}

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

            {isPlatformOwner ? (
              <>
                <label style={styles.toggleCard}>
                  <input
                    type="checkbox"
                    name="crm_enabled"
                    defaultChecked={formState.crm_enabled}
                  />

                  <div>
                    <div style={styles.toggleCardTitle}>CRM</div>

                    <div style={styles.toggleCardText}>
                      Enable CRM/customer management features for this tenant.
                    </div>
                  </div>
                </label>

                <label style={styles.toggleCard}>
                  <input
                    type="checkbox"
                    name="auctions_enabled"
                    defaultChecked={formState.auctions_enabled}
                  />

                  <div>
                    <div style={styles.toggleCardTitle}>Auctions</div>

                    <div style={styles.toggleCardText}>
                      Enable silent auction campaign tools.
                    </div>
                  </div>
                </label>

                <label style={styles.toggleCard}>
                  <input
                    type="checkbox"
                    name="reserved_seating_enabled"
                    defaultChecked={formState.reserved_seating_enabled}
                  />

                  <div>
                    <div style={styles.toggleCardTitle}>Reserved seating</div>

                    <div style={styles.toggleCardText}>
                      Enable reserved seating and table event controls.
                    </div>
                  </div>
                </label>

                <label style={styles.toggleCard}>
                  <input
                    type="checkbox"
                    name="finance_dashboard_enabled"
                    defaultChecked={formState.finance_dashboard_enabled}
                  />

                  <div>
                    <div style={styles.toggleCardTitle}>Finance dashboard</div>

                    <div style={styles.toggleCardText}>
                      Enable tenant finance reporting views.
                    </div>
                  </div>
                </label>
                                <label style={styles.toggleCard}>
                  <input
                    type="checkbox"
                    name="white_label_enabled"
                    defaultChecked={formState.white_label_enabled}
                  />

                  <div>
                    <div style={styles.toggleCardTitle}>White label</div>

                    <div style={styles.toggleCardText}>
                      Enable reduced SO branding / white-label direction.
                    </div>
                  </div>
                </label>

                <label style={styles.toggleCard}>
                  <input
                    type="checkbox"
                    name="custom_domain_enabled"
                    defaultChecked={formState.custom_domain_enabled}
                  />

                  <div>
                    <div style={styles.toggleCardTitle}>Custom domain</div>

                    <div style={styles.toggleCardText}>
                      Mark this tenant as eligible for custom-domain support.
                    </div>
                  </div>
                </label>

                <label style={styles.ownerBypassCard}>
                  <input
                    type="checkbox"
                    name="platform_owner_bypass"
                    defaultChecked={formState.platform_owner_bypass}
                  />

                  <div>
                    <div style={styles.toggleCardTitle}>
                      Platform owner bypass
                    </div>

                    <div style={styles.toggleCardText}>
                      Gives this tenant all platform capabilities and can be used
                      for internal/free owner tenants. Use carefully.
                    </div>
                  </div>
                </label>
              </>
            ) : (
              capabilities.map((item) => (
                <div key={item.key} style={styles.readOnlyToggleCard}>
                  <span
                    style={{
                      ...styles.statusDot,
                      ...(item.enabled
                        ? styles.statusDotOn
                        : styles.statusDotOff),
                    }}
                  />

                  <div>
                    <div style={styles.toggleCardTitle}>{item.label}</div>

                    <div style={styles.toggleCardText}>
                      {enabledLabel(item.enabled)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {isPlatformOwner ? (
            <div style={styles.ownerWarning}>
              <strong>Owner control warning:</strong> these settings affect
              subscription access, platform commission and premium feature
              gating for this tenant. They should only be changed intentionally.
            </div>
          ) : null}

          <div className="submitRow" style={styles.submitRow}>
            <button type="submit" style={styles.saveButton}>
              {isPlatformOwner
                ? "Save billing and feature settings"
                : "Save contribution setting"}
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
                  <div className="tierTop" style={styles.tierTop}>
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

function HeroStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={styles.heroStat}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div style={styles.miniMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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
  .billing-page .heroMainGrid,
  .billing-page .contentGrid,
  .billing-page .stripeActionPanel {
    grid-template-columns: 1fr !important;
  }

  .billing-page .heroStats,
  .billing-page .heroPanelGrid,
  .billing-page .formGrid,
  .billing-page .toggleGrid,
  .billing-page .readinessGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .billing-page .heroActions {
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
  .billing-page .heroStats,
  .billing-page .heroPanelGrid,
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
                    <label style={styles.toggleCard}>
                  <input
                    type="checkbox"
                    name="white_label_enabled"
                    defaultChecked={formState.white_label_enabled}
                  />

                  <div>
                    <div style={styles.toggleCardTitle}>White label</div>

                    <div style={styles.toggleCardText}>
                      Enable reduced SO branding / white-label direction.
                    </div>
                  </div>
                </label>

                <label style={styles.toggleCard}>
                  <input
                    type="checkbox"
                    name="custom_domain_enabled"
                    defaultChecked={formState.custom_domain_enabled}
                  />

                  <div>
                    <div style={styles.toggleCardTitle}>Custom domain</div>

                    <div style={styles.toggleCardText}>
                      Mark this tenant as eligible for custom-domain support.
                    </div>
                  </div>
                </label>

                <label style={styles.ownerBypassCard}>
                  <input
                    type="checkbox"
                    name="platform_owner_bypass"
                    defaultChecked={formState.platform_owner_bypass}
                  />

                  <div>
                    <div style={styles.toggleCardTitle}>
                      Platform owner bypass
                    </div>

                    <div style={styles.toggleCardText}>
                      Gives this tenant all platform capabilities and can be used
                      for internal/free owner tenants. Use carefully.
                    </div>
                  </div>
                </label>
              </>
            ) : (
              capabilities.map((item) => (
                <div key={item.key} style={styles.readOnlyToggleCard}>
                  <span
                    style={{
                      ...styles.statusDot,
                      ...(item.enabled
                        ? styles.statusDotOn
                        : styles.statusDotOff),
                    }}
                  />

                  <div>
                    <div style={styles.toggleCardTitle}>{item.label}</div>

                    <div style={styles.toggleCardText}>
                      {enabledLabel(item.enabled)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {isPlatformOwner ? (
            <div style={styles.ownerWarning}>
              <strong>Owner control warning:</strong> these settings affect
              subscription access, platform commission and premium feature
              gating for this tenant. They should only be changed intentionally.
            </div>
          ) : null}

          <div className="submitRow" style={styles.submitRow}>
            <button type="submit" style={styles.saveButton}>
              {isPlatformOwner
                ? "Save billing and feature settings"
                : "Save contribution setting"}
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
                  <div className="tierTop" style={styles.tierTop}>
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

function HeroStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={styles.heroStat}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div style={styles.miniMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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
  .billing-page .heroMainGrid,
  .billing-page .contentGrid,
  .billing-page .stripeActionPanel {
    grid-template-columns: 1fr !important;
  }

  .billing-page .heroStats,
  .billing-page .heroPanelGrid,
  .billing-page .formGrid,
  .billing-page .toggleGrid,
  .billing-page .readinessGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .billing-page .heroActions {
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
  .billing-page .heroStats,
  .billing-page .heroPanelGrid,
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
