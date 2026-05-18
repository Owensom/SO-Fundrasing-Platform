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
  getCampaignLimitMessage,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";
import NewEventForm from "@/components/admin/NewEventForm";

type PageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

type ActiveCampaignCountRow = {
  active_count: string | number;
};

async function getActivePublishedCampaignCountForTenant(tenantSlug: string) {
  const rows = await query<ActiveCampaignCountRow>(
    `
      select count(*) as active_count
      from (
        select id
        from raffles
        where tenant_slug = $1
          and status = 'published'

        union all

        select id
        from squares
        where tenant_slug = $1
          and status = 'published'

        union all

        select id
        from events
        where tenant_slug = $1
          and status = 'published'
      ) active_campaigns
    `,
    [tenantSlug],
  );

  return Number(rows[0]?.active_count || 0);
}

export default async function NewEventPage({ searchParams }: PageProps) {
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

  const resolvedSearchParams = await searchParams;
  const tenantSettings = await getTenantSettings(tenantSlug);

  const customImagesCapability = checkSubscriptionCapability(
    tenantSettings,
    "custom_campaign_images",
  );

  const subscriptionTier = normaliseSubscriptionTier(
    tenantSettings?.subscription_tier,
  );
  const activePublishedCampaignCount =
    await getActivePublishedCampaignCountForTenant(tenantSlug);

  const canPublishCampaign = canPublishAnotherCampaign({
    subscription_tier: subscriptionTier,
    currentActiveCampaigns: activePublishedCampaignCount,
  });

  const showCampaignLimitBanner =
    resolvedSearchParams?.error === "campaign-limit" || !canPublishCampaign;

  return (
    <main className="new-event-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      {showCampaignLimitBanner ? (
        <section className="campaign-limit-banner" style={styles.limitBanner}>
          <div style={styles.limitContent}>
            <div style={styles.limitEyebrow}>Premium campaign limit</div>
            <h1 style={styles.limitTitle}>
              {getCampaignLimitMessage(subscriptionTier)}
            </h1>
            <p style={styles.limitText}>
              You can still create and save draft events. To publish more active
              campaigns at the same time, upgrade your plan from Billing.
            </p>
          </div>

          <Link href="/admin/billing" style={styles.limitButton}>
            View billing plans
          </Link>
        </section>
      ) : null}

      <NewEventForm
        tenantSlug={tenantSlug}
        subscriptionTier={tenantSettings?.subscription_tier}
        customImagesAllowed={customImagesCapability.allowed}
      />
    </main>
  );
}

const responsiveStyles = `
  .new-event-page,
  .new-event-page * {
    box-sizing: border-box;
  }

  .new-event-page {
    overflow-x: hidden;
  }

  .campaign-limit-banner {
    width: 100%;
  }

  @media (max-width: 720px) {
    .campaign-limit-banner {
      align-items: stretch !important;
      flex-direction: column !important;
    }

    .campaign-limit-banner a {
      width: 100% !important;
      justify-content: center !important;
      text-align: center !important;
    }
  }

  @media (max-width: 640px) {
    .new-event-page {
      width: 100% !important;
      max-width: 100% !important;
      padding: 18px 12px 44px !important;
    }
  }
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: "28px 16px 56px",
    background: "#f8fafc",
    minHeight: "100vh",
    overflowX: "hidden",
    boxSizing: "border-box",
  },
  limitBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    marginBottom: 22,
    padding: "20px 22px",
    borderRadius: 24,
    border: "1px solid rgba(202, 138, 4, 0.28)",
    background:
      "linear-gradient(135deg, rgba(255, 251, 235, 0.98), rgba(254, 243, 199, 0.92))",
    boxShadow: "0 18px 42px rgba(15, 23, 42, 0.08)",
  },
  limitContent: {
    minWidth: 0,
  },
  limitEyebrow: {
    marginBottom: 6,
    color: "#92400e",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  limitTitle: {
    margin: 0,
    color: "#111827",
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: "-0.04em",
    lineHeight: 1.1,
  },
  limitText: {
    maxWidth: 720,
    margin: "8px 0 0",
    color: "#78350f",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  limitButton: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "12px 18px",
    borderRadius: 999,
    background: "#111827",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 900,
    textDecoration: "none",
    boxShadow: "0 14px 28px rgba(15, 23, 42, 0.18)",
  },
};
