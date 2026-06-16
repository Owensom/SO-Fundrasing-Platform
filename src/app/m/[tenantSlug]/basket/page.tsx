import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import MerchandiseBasketClient from "@/components/merchandise/MerchandiseBasketClient";
import { getTenantSettings } from "@/lib/tenant-settings";
import { checkSubscriptionCapability } from "@/lib/subscription-capabilities";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    tenantSlug: string;
  }>;
};

type TenantPublicSettings = {
  public_display_name?: string | null;
  public_logo_url?: string | null;
  public_logo_mark_url?: string | null;
  public_primary_colour?: string | null;
  public_accent_colour?: string | null;
  subscription_tier?: string | null;
  subscription_status?: string | null;
  platform_owner_bypass?: boolean | null;
  buyer_fee_contributions_enabled?: boolean | null;
};

function cleanText(value: unknown, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function normaliseHexColour(value: unknown, fallback: string) {
  const clean = cleanText(value).toUpperCase();

  if (/^#[0-9A-F]{6}$/.test(clean)) {
    return clean;
  }

  return fallback;
}

function hexToRgb(hex: string) {
  const clean = normaliseHexColour(hex, "#0F172A").replace("#", "");

  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

function getReadableTextColour(background: string) {
  const { r, g, b } = hexToRgb(background);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.62 ? "#0f172a" : "#ffffff";
}

function getDisplayName(settings: TenantPublicSettings | null) {
  return cleanText(settings?.public_display_name) || "SO Fundraising Platform";
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { tenantSlug } = await params;
  const tenantSettings = (await getTenantSettings(
    tenantSlug,
  )) as TenantPublicSettings | null;
  const displayName = getDisplayName(tenantSettings);

  return {
    title: `Merchandise basket | ${displayName}`,
    description: `Review merchandise basket for ${displayName}.`,
  };
}

export default async function PublicMerchandiseBasketPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const tenantSettings = (await getTenantSettings(
    tenantSlug,
  )) as TenantPublicSettings | null;

  const advancedBrandingCapability = checkSubscriptionCapability(
    tenantSettings,
    "advanced_branding",
  );

  const canUseAdvancedBranding = advancedBrandingCapability.allowed;
  const displayName = getDisplayName(tenantSettings);

  const primaryColour = canUseAdvancedBranding
    ? normaliseHexColour(tenantSettings?.public_primary_colour, "#1683F8")
    : "#1683F8";

  const accentColour = canUseAdvancedBranding
    ? normaliseHexColour(tenantSettings?.public_accent_colour, "#FACC15")
    : "#FACC15";

  const primaryTextColour = getReadableTextColour(primaryColour);
  const buyerFeeContributionsEnabled = Boolean(
    tenantSettings?.buyer_fee_contributions_enabled,
  );

  return (
    <main className="public-merchandise-basket-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section
        style={{
          ...styles.hero,
          background: `radial-gradient(circle at bottom right, ${accentColour}24, transparent 38%), radial-gradient(circle at top left, ${primaryColour}24, transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 58%, #172554 100%)`,
        }}
      >
        <div style={styles.heroCopy}>
          <Link href={`/m/${tenantSlug}`} style={styles.backLink}>
            ← Back to shop
          </Link>

          <p style={{ ...styles.kicker, color: accentColour }}>
            Merchandise basket
          </p>

          <h1 className="basket-title" style={styles.title}>
            Review basket
          </h1>

          <p style={styles.subtitle}>
            Review selected merchandise for {displayName}, add any collection or
            delivery details, and continue to secure Stripe checkout.
          </p>
        </div>
      </section>

      <section style={styles.contentShell}>
        <MerchandiseBasketClient
          tenantSlug={tenantSlug}
          shopHref={`/m/${tenantSlug}`}
          primaryColour={primaryColour}
          primaryTextColour={primaryTextColour}
          buyerFeeContributionsEnabled={buyerFeeContributionsEnabled}
        />
      </section>
    </main>
  );
}

const responsiveStyles = `
.public-merchandise-basket-page,
.public-merchandise-basket-page * {
  box-sizing: border-box;
}

.public-merchandise-basket-page {
  overflow-x: hidden;
}

@media (max-width: 640px) {
  .public-merchandise-basket-page {
    padding: 14px 10px 34px !important;
  }

  .public-merchandise-basket-page .basket-title {
    font-size: clamp(42px, 13vw, 60px) !important;
    line-height: 0.96 !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    width: "100%",
    padding: "24px 14px 48px",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 34%), radial-gradient(circle at top right, rgba(250,204,21,0.12), transparent 32%), #f8fafc",
    color: "#0f172a",
    overflowX: "hidden",
  },

  hero: {
    display: "grid",
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto 16px",
    padding: 26,
    borderRadius: 34,
    color: "#ffffff",
    boxShadow: "0 24px 60px rgba(15,23,42,0.20)",
    border: "1px solid rgba(148,163,184,0.26)",
    overflow: "hidden",
  },

  heroCopy: {
    display: "grid",
    gap: 12,
    alignContent: "start",
  },

  backLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    minHeight: 40,
    padding: "9px 13px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
  },

  kicker: {
    margin: 0,
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  title: {
    margin: 0,
    color: "#ffffff",
    fontSize: "clamp(48px, 7vw, 78px)",
    lineHeight: 0.92,
    letterSpacing: "-0.08em",
    overflowWrap: "anywhere",
  },

  subtitle: {
    margin: 0,
    maxWidth: 820,
    color: "#dbeafe",
    fontSize: 17,
    lineHeight: 1.55,
    fontWeight: 730,
    overflowWrap: "anywhere",
  },

  contentShell: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
  },
};
