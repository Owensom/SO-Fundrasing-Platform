import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";
import {
  canPublishAnotherCampaign,
  checkSubscriptionCapability,
  getMaximumActiveCampaignsForTier,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";
import NewRaffleForm from "@/components/admin/NewRaffleForm";

type PageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

type ActiveCampaignCountRow = {
  total: number | string;
};

async function getActiveCampaignCount(tenantSlug: string) {
  const rows = await query<ActiveCampaignCountRow>(
    `
      select count(*)::int as total
      from (
        select 1
        from raffles
        where tenant_slug = $1
          and status = 'published'

        union all

        select 1
        from squares_games
        where tenant_slug = $1
          and status = 'published'

        union all

        select 1
        from events
        where tenant_slug = $1
          and status = 'published'
      ) active_campaigns
    `,
    [tenantSlug],
  );

  return Number(rows[0]?.total || 0);
}

function formatCampaignLimit(value: number) {
  if (!Number.isFinite(value)) return "unlimited active campaigns";

  return `${value} active campaign${value === 1 ? "" : "s"}`;
}

function formatTierName(value: string) {
  if (value === "foundation") return "Foundation";
  if (value === "professional") return "Professional";
  return "Community";
}

export default async function NewRafflePage({ searchParams }: PageProps) {
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

  const resolvedSearchParams = searchParams ? await searchParams : {};

  const [tenantSettings, activeCampaignCount] = await Promise.all([
    getTenantSettings(tenantSlug),
    getActiveCampaignCount(tenantSlug),
  ]);

  const subscriptionTier = normaliseSubscriptionTier(
    tenantSettings?.subscription_tier,
  );

  const maxActiveCampaigns = getMaximumActiveCampaignsForTier(subscriptionTier);

  const canPublishCampaign = canPublishAnotherCampaign({
    subscription_tier: tenantSettings?.subscription_tier,
    currentActiveCampaigns: activeCampaignCount,
  });

  const customImagesCapability = checkSubscriptionCapability(
    tenantSettings,
    "custom_campaign_images",
  );

  const campaignLimitRedirect =
    resolvedSearchParams?.error === "campaign_limit";

  const drawDateError =
    resolvedSearchParams?.error === "invalid_draw_datetime";

  const showCampaignLimitBanner =
    campaignLimitRedirect || !canPublishCampaign;

  const limitTitle = campaignLimitRedirect
    ? "This raffle was saved as a draft because the active campaign limit was reached."
    : canPublishCampaign
      ? "You can publish another raffle."
      : "Active campaign limit reached.";

  const limitText = canPublishCampaign
    ? `This tenant is currently using ${activeCampaignCount} of ${formatCampaignLimit(
        maxActiveCampaigns,
      )}. You can create and publish this raffle when ready.`
    : `This tenant is currently using ${activeCampaignCount} of ${formatCampaignLimit(
        maxActiveCampaigns,
      )} across raffles, squares and events. You can still create this raffle as a draft, but publishing will be blocked until an active campaign is closed/unpublished or the tenant plan is upgraded.`;

  return (
    <main className="new-raffle-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="new-raffle-topbar" style={styles.topbar}>
        <Link href="/admin/raffles" style={styles.backButton}>
          ← Back to raffles
        </Link>

        <Link href="/admin" style={styles.dashboardButton}>
          Dashboard
        </Link>
      </section>

      <section className="new-raffle-limit-panel" style={styles.limitPanel}>
        <div style={styles.limitCopy}>
          <div style={styles.limitEyebrow}>Subscription enforcement</div>

          <h1 style={styles.limitTitle}>
            {canPublishCampaign
              ? "Raffle publishing is available."
              : "Draft creation remains available."}
          </h1>

          <p style={styles.limitText}>
            {canPublishCampaign
              ? "This tenant is within the current active campaign allowance."
              : "This tenant has reached the current active campaign allowance. The form remains available so you can prepare a draft, but the API will block publishing until capacity is available."}
          </p>
        </div>

        <div className="new-raffle-limit-stats" style={styles.limitStats}>
          <div style={styles.limitStat}>
            <span>Plan</span>
            <strong>{formatTierName(subscriptionTier)}</strong>
          </div>

          <div style={styles.limitStat}>
            <span>Active campaigns</span>
            <strong>{activeCampaignCount}</strong>
          </div>

          <div style={styles.limitStat}>
            <span>Allowed</span>
            <strong>{formatCampaignLimit(maxActiveCampaigns)}</strong>
          </div>
        </div>
      </section>

      {drawDateError ? (
        <section
          className="new-raffle-validation-banner"
          style={styles.validationBanner}
        >
          <div style={styles.validationEyebrow}>Date format issue</div>

          <h1 style={styles.validationTitle}>Please check the draw date.</h1>

          <p style={styles.validationText}>
            Draw date must use UK format, for example{" "}
            <strong>31/10/2026</strong>. Draw time must use 24-hour format, for
            example <strong>19:00</strong>. You can also leave both fields blank
            while saving a draft.
          </p>
        </section>
      ) : null}

      {showCampaignLimitBanner ? (
        <section className="new-raffle-upgrade-banner" style={styles.upgradeBanner}>
          <div style={styles.upgradeEyebrow}>Plan limit notice</div>

          <h1 style={styles.upgradeTitle}>{limitTitle}</h1>

          <p style={styles.upgradeText}>{limitText}</p>

          <div className="new-raffle-upgrade-actions" style={styles.upgradeActions}>
            <Link
              href="/admin/settings/billing"
              style={styles.primaryUpgradeButton}
            >
              View billing
            </Link>

            <Link href="/admin/raffles" style={styles.secondaryUpgradeButton}>
              Manage raffles
            </Link>
          </div>
        </section>
      ) : null}

      <NewRaffleForm
        tenantSlug={tenantSlug}
        subscriptionTier={tenantSettings?.subscription_tier}
        customImagesAllowed={customImagesCapability.allowed}
      />
    </main>
  );
}

const responsiveStyles = `
  .new-raffle-page,
  .new-raffle-page * {
    box-sizing: border-box;
  }

  .new-raffle-page {
    overflow-x: hidden;
  }

  .new-raffle-page a,
  .new-raffle-page button,
  .new-raffle-page input,
  .new-raffle-page textarea,
  .new-raffle-page select {
    max-width: 100%;
  }

  .new-raffle-limit-panel,
  .new-raffle-upgrade-banner,
  .new-raffle-validation-banner {
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
  }

  .new-raffle-limit-panel h1,
  .new-raffle-limit-panel p,
  .new-raffle-limit-panel span,
  .new-raffle-limit-panel strong,
  .new-raffle-upgrade-banner h1,
  .new-raffle-upgrade-banner p,
  .new-raffle-validation-banner h1,
  .new-raffle-validation-banner p {
    overflow-wrap: anywhere;
  }

  @media (max-width: 760px) {
    .new-raffle-page {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 auto !important;
      padding: 18px 12px 44px !important;
    }

    .new-raffle-topbar {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 10px !important;
      margin-bottom: 16px !important;
    }

    .new-raffle-topbar a {
      width: 100% !important;
      min-height: 50px !important;
      text-align: center !important;
      padding: 13px 16px !important;
    }

    .new-raffle-limit-panel {
      grid-template-columns: 1fr !important;
      gap: 14px !important;
      padding: 18px 14px !important;
      border-radius: 22px !important;
      margin-bottom: 16px !important;
    }

    .new-raffle-limit-stats {
      grid-template-columns: 1fr !important;
      gap: 10px !important;
      width: 100% !important;
    }

    .new-raffle-limit-stats > div {
      width: 100% !important;
    }

    .new-raffle-upgrade-banner,
    .new-raffle-validation-banner {
      padding: 18px 14px !important;
      border-radius: 22px !important;
    }

    .new-raffle-upgrade-actions {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }

    .new-raffle-upgrade-actions a {
      width: 100% !important;
      justify-content: center !important;
      text-align: center !important;
    }
  }

  @media (max-width: 420px) {
    .new-raffle-limit-panel {
      padding: 16px 12px !important;
    }

    .new-raffle-limit-panel h1,
    .new-raffle-upgrade-banner h1,
    .new-raffle-validation-banner h1 {
      font-size: 28px !important;
      line-height: 1.05 !important;
    }
  }
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1040,
    margin: "40px auto",
    padding: "0 16px 48px",
    overflowX: "hidden",
  },
  topbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  backButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 18px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 950,
    boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
  },
  dashboardButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 18px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    textDecoration: "none",
    fontWeight: 950,
    boxShadow: "0 10px 24px rgba(15,23,42,0.16)",
  },
  limitPanel: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 0.8fr)",
    gap: 16,
    alignItems: "center",
    marginBottom: 18,
    padding: "clamp(18px, 4vw, 24px)",
    borderRadius: 26,
    background:
      "linear-gradient(135deg, #ffffff 0%, #eff6ff 52%, #f8fafc 100%)",
    border: "1px solid #dbeafe",
    boxShadow: "0 16px 38px rgba(15,23,42,0.06)",
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },
  limitCopy: {
    minWidth: 0,
  },
  limitEyebrow: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 10,
  },
  limitTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(26px, 5vw, 34px)",
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
  },
  limitText: {
    margin: "10px 0 0",
    color: "#475569",
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 780,
  },
  limitStats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    minWidth: 0,
  },
  limitStat: {
    display: "grid",
    gap: 4,
    padding: 13,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  validationBanner: {
    marginBottom: 18,
    padding: "clamp(18px, 4vw, 24px)",
    borderRadius: 26,
    background:
      "linear-gradient(135deg, #fff7ed 0%, #ffffff 48%, #eff6ff 100%)",
    border: "1px solid #fed7aa",
    boxShadow: "0 16px 38px rgba(15,23,42,0.08)",
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },
  validationEyebrow: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#ffedd5",
    color: "#9a3412",
    border: "1px solid #fed7aa",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 10,
  },
  validationTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(26px, 5vw, 34px)",
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
  },
  validationText: {
    margin: "10px 0 0",
    color: "#475569",
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 780,
  },
  upgradeBanner: {
    marginBottom: 18,
    padding: "clamp(18px, 4vw, 24px)",
    borderRadius: 26,
    background:
      "linear-gradient(135deg, #fff7ed 0%, #ffffff 48%, #eff6ff 100%)",
    border: "1px solid #fed7aa",
    boxShadow: "0 16px 38px rgba(15,23,42,0.08)",
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },
  upgradeEyebrow: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#ffedd5",
    color: "#9a3412",
    border: "1px solid #fed7aa",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 10,
  },
  upgradeTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(26px, 5vw, 34px)",
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
  },
  upgradeText: {
    margin: "10px 0 0",
    color: "#475569",
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 780,
  },
  upgradeActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  primaryUpgradeButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    padding: "12px 16px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    border: "1px solid #1683f8",
    boxShadow: "0 10px 22px rgba(22,131,248,0.22)",
  },
  secondaryUpgradeButton: {
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
  },
};
