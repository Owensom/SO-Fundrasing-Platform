import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";
import { checkSubscriptionCapability } from "@/lib/subscription-capabilities";
import NewEventForm from "@/components/admin/NewEventForm";

export default async function NewEventPage() {
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
    <main className="new-event-page" style={styles.page}>
      <style>{responsiveStyles}</style>

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
};
