import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";
import { checkSubscriptionCapability } from "@/lib/subscription-capabilities";
import NewRaffleForm from "@/components/admin/NewRaffleForm";

export default async function NewRafflePage() {
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

  const tenantSettings = await getTenantSettings(tenantSlug);

  const customImagesCapability = checkSubscriptionCapability(
    tenantSettings,
    "custom_campaign_images",
  );

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

  @media (max-width: 640px) {
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
};
