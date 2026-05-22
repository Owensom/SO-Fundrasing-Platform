import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import {
  checkSubscriptionCapability,
  getTierLabel,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SessionUserWithTenants = {
  tenantSlugs?: string[];
  isPlatformOwner?: boolean;
};

type BrandingSettings = {
  tenant_slug: string;
  subscription_tier: string | null;
  subscription_status: string | null;
  platform_owner_bypass: boolean | null;
  public_display_name: string | null;
  public_tagline: string | null;
  public_logo_url: string | null;
  public_logo_mark_url: string | null;
  public_primary_colour: string | null;
  public_accent_colour: string | null;
  public_footer_text: string | null;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function cleanLimitedText(value: unknown, maxLength: number) {
  return cleanText(value).slice(0, maxLength);
}

function cleanOptionalUrl(value: unknown) {
  const clean = cleanText(value);

  if (!clean) return "";

  if (
    clean.startsWith("/") ||
    clean.startsWith("https://") ||
    clean.startsWith("http://")
  ) {
    return clean.slice(0, 1000);
  }

  return "";
}

function cleanHexColour(value: unknown, fallback = "") {
  const clean = cleanText(value);

  if (!clean) return "";

  if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
    return clean.toUpperCase();
  }

  return fallback;
}

async function requireCurrentTenantAccess() {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionUser = session.user as SessionUserWithTenants;

  const sessionTenantSlugs = Array.isArray(sessionUser.tenantSlugs)
    ? sessionUser.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  return {
    tenantSlug,
    isPlatformOwner: Boolean(sessionUser.isPlatformOwner),
  };
}

async function getBrandingSettings(tenantSlug: string) {
  return queryOne<BrandingSettings>(
    `
      select
        tenant_slug,
        subscription_tier,
        subscription_status,
        platform_owner_bypass,
        public_display_name,
        public_tagline,
        public_logo_url,
        public_logo_mark_url,
        public_primary_colour,
        public_accent_colour,
        public_footer_text
      from tenant_settings
      where tenant_slug = $1
      limit 1
    `,
    [tenantSlug],
  );
}

async function updateTenantBranding(formData: FormData) {
  "use server";

  const access = await requireCurrentTenantAccess();
  const tenantSlug = access.tenantSlug;

  const existingSettings = await getBrandingSettings(tenantSlug);

  const subscriptionTier = normaliseSubscriptionTier(
    existingSettings?.subscription_tier,
  );

  const capabilityTenant = {
    subscription_tier: subscriptionTier,
    subscription_status: existingSettings?.subscription_status || "active",
    platform_owner_bypass: Boolean(existingSettings?.platform_owner_bypass),
  };

  const advancedBrandingCapability = checkSubscriptionCapability(
    capabilityTenant,
    "advanced_branding",
  );

  const canUseAdvancedBranding =
    advancedBrandingCapability.allowed || access.isPlatformOwner;

  const nextDisplayName = cleanLimitedText(
    formData.get("public_display_name"),
    90,
  );

  const nextTagline = cleanLimitedText(formData.get("public_tagline"), 180);

  const nextLogoUrl = canUseAdvancedBranding
    ? cleanOptionalUrl(formData.get("public_logo_url"))
    : existingSettings?.public_logo_url || "";

  const nextLogoMarkUrl = canUseAdvancedBranding
    ? cleanOptionalUrl(formData.get("public_logo_mark_url"))
    : existingSettings?.public_logo_mark_url || "";

  const nextPrimaryColour = canUseAdvancedBranding
    ? cleanHexColour(
        formData.get("public_primary_colour"),
        existingSettings?.public_primary_colour || "",
      )
    : existingSettings?.public_primary_colour || "";

  const nextAccentColour = canUseAdvancedBranding
    ? cleanHexColour(
        formData.get("public_accent_colour"),
        existingSettings?.public_accent_colour || "",
      )
    : existingSettings?.public_accent_colour || "";

  const nextFooterText = canUseAdvancedBranding
    ? cleanLimitedText(formData.get("public_footer_text"), 180)
    : existingSettings?.public_footer_text || "";

  await query(
    `
      insert into tenant_settings (
        tenant_slug,
        public_display_name,
        public_tagline,
        public_logo_url,
        public_logo_mark_url,
        public_primary_colour,
        public_accent_colour,
        public_footer_text
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (tenant_slug)
      do update set
        public_display_name = excluded.public_display_name,
        public_tagline = excluded.public_tagline,
        public_logo_url = excluded.public_logo_url,
        public_logo_mark_url = excluded.public_logo_mark_url,
        public_primary_colour = excluded.public_primary_colour,
        public_accent_colour = excluded.public_accent_colour,
        public_footer_text = excluded.public_footer_text,
        updated_at = now()
    `,
    [
      tenantSlug,
      nextDisplayName || null,
      nextTagline || null,
      nextLogoUrl || null,
      nextLogoMarkUrl || null,
      nextPrimaryColour || null,
      nextAccentColour || null,
      nextFooterText || null,
    ],
  );

  revalidatePath("/admin/settings/branding");
  revalidatePath("/admin");
  revalidatePath(`/c/${tenantSlug}`);
  redirect("/admin/settings/branding?saved=1");
}

export default async function AdminBrandingSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    saved?: string;
  }>;
}) {
  const access = await requireCurrentTenantAccess();
  const tenantSlug = access.tenantSlug;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const settings = await getBrandingSettings(tenantSlug);

  const subscriptionTier = normaliseSubscriptionTier(
    settings?.subscription_tier,
  );

  const capabilityTenant = {
    subscription_tier: subscriptionTier,
    subscription_status: settings?.subscription_status || "active",
    platform_owner_bypass: Boolean(settings?.platform_owner_bypass),
  };

  const advancedBrandingCapability = checkSubscriptionCapability(
    capabilityTenant,
    "advanced_branding",
  );

  const canUseAdvancedBranding =
    advancedBrandingCapability.allowed || access.isPlatformOwner;

  const saved = resolvedSearchParams.saved === "1";

  const displayName = settings?.public_display_name || "";
  const tagline = settings?.public_tagline || "";
  const logoUrl = settings?.public_logo_url || "";
  const logoMarkUrl = settings?.public_logo_mark_url || "";
  const primaryColour = settings?.public_primary_colour || "#1683F8";
  const accentColour = settings?.public_accent_colour || "#FACC15";
  const footerText = settings?.public_footer_text || "";

  return (
    <main className="branding-settings-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="branding-hero" style={styles.hero}>
        <div>
          <Link href="/admin" style={styles.backLink}>
            ← Back to dashboard
          </Link>

          <div style={styles.badgeRow}>
            <span style={styles.badge}>Tenant branding</span>
            <span style={styles.softBadge}>{getTierLabel(subscriptionTier)} plan</span>
          </div>

          <h1 className="so-brand-heading branding-title" style={styles.title}>
            Branding settings
          </h1>

          <p style={styles.subtitle}>
            Set the public name and messaging for this tenant. Advanced logo,
            colour and footer controls are available on higher plans.
          </p>

          <p style={styles.tenant}>
            Tenant: <strong>{tenantSlug}</strong>
          </p>
        </div>

        <div style={styles.heroPanel}>
          <p style={styles.heroPanelEyebrow}>Brand preview</p>

          <div style={styles.previewLogoWrap}>
            {logoMarkUrl || logoUrl ? (
              <img
                src={logoMarkUrl || logoUrl}
                alt={displayName || tenantSlug}
                style={styles.previewLogo}
              />
            ) : (
              <span style={styles.previewLogoFallback}>
                {(displayName || tenantSlug).slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          <h2 style={styles.heroPanelTitle}>{displayName || tenantSlug}</h2>

          <p style={styles.heroPanelText}>
            {tagline || "Your public tenant tagline will appear here."}
          </p>

          <div style={styles.colourPreviewRow}>
            <span
              style={{
                ...styles.colourPreview,
                background: primaryColour,
              }}
            />
            <span
              style={{
                ...styles.colourPreview,
                background: accentColour,
              }}
            />
          </div>
        </div>
      </section>

      {saved ? (
        <section style={styles.successCard}>
          <strong>Branding settings saved.</strong>
          <span>The tenant branding details have been updated.</span>
        </section>
      ) : null}

      <section className="settings-grid" style={styles.settingsGrid}>
        <section className="form-card" style={styles.formCard}>
          <p style={styles.kicker}>Public identity</p>

          <h2 style={styles.sectionTitle}>Basic branding</h2>

          <p style={styles.sectionText}>
            These details can be used across the public campaign hub and later
            in campaign pages and emails.
          </p>

          <form action={updateTenantBranding} style={styles.form}>
            <label style={styles.field}>
              <span style={styles.label}>Public display name</span>
              <input
                name="public_display_name"
                defaultValue={displayName}
                placeholder="Example: Brave Ceilidh"
                maxLength={90}
                style={styles.input}
              />
              <span style={styles.hint}>
                Included for all tenants. Leave blank to use the tenant slug.
              </span>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Short tagline</span>
              <input
                name="public_tagline"
                defaultValue={tagline}
                placeholder="Example: Fundraising for local causes"
                maxLength={180}
                style={styles.input}
              />
              <span style={styles.hint}>
                Included for all tenants. Keep this short and public-facing.
              </span>
            </label>

            <div style={styles.divider} />

            <div style={styles.advancedHeader}>
              <div>
                <p style={styles.kicker}>Advanced branding</p>
                <h2 style={styles.sectionTitle}>Logo, colours and footer</h2>
              </div>

              <span
                style={{
                  ...styles.planPill,
                  ...(canUseAdvancedBranding
                    ? styles.planPillIncluded
                    : styles.planPillLocked),
                }}
              >
                {canUseAdvancedBranding ? "Available" : "Professional required"}
              </span>
            </div>

            <fieldset
              disabled={!canUseAdvancedBranding}
              style={{
                ...styles.fieldset,
                ...(!canUseAdvancedBranding ? styles.disabledFieldset : {}),
              }}
            >
              <label style={styles.field}>
                <span style={styles.label}>Logo URL</span>
                <input
                  name="public_logo_url"
                  defaultValue={logoUrl}
                  placeholder="/brand/example-logo.png or https://..."
                  style={styles.input}
                />
                <span style={styles.hint}>
                  Use a transparent PNG or SVG-style logo where possible.
                </span>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Logo mark URL</span>
                <input
                  name="public_logo_mark_url"
                  defaultValue={logoMarkUrl}
                  placeholder="/brand/example-mark.png or https://..."
                  style={styles.input}
                />
                <span style={styles.hint}>
                  Optional square/icon version for compact spaces.
                </span>
              </label>

              <div className="colour-grid" style={styles.colourGrid}>
                <label style={styles.field}>
                  <span style={styles.label}>Primary colour</span>
                  <input
                    name="public_primary_colour"
                    defaultValue={primaryColour}
                    placeholder="#1683F8"
                    pattern="^#[0-9a-fA-F]{6}$"
                    style={styles.input}
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Accent colour</span>
                  <input
                    name="public_accent_colour"
                    defaultValue={accentColour}
                    placeholder="#FACC15"
                    pattern="^#[0-9a-fA-F]{6}$"
                    style={styles.input}
                  />
                </label>
              </div>

              <label style={styles.field}>
                <span style={styles.label}>Public footer wording</span>
                <input
                  name="public_footer_text"
                  defaultValue={footerText}
                  placeholder="Example: Supporting local community fundraising"
                  maxLength={180}
                  style={styles.input}
                />
              </label>
            </fieldset>

            {!canUseAdvancedBranding ? (
              <section style={styles.lockedNotice}>
                <strong>Advanced branding is not active on this plan.</strong>
                <span>
                  Display name and tagline can be saved now. Logos, colours and
                  footer wording will remain unchanged until advanced branding
                  is available for this tenant.
                </span>
              </section>
            ) : null}

            <button type="submit" style={styles.primaryButton}>
              Save branding settings
            </button>
          </form>
        </section>

        <aside className="preview-card" style={styles.previewCard}>
          <p style={styles.kicker}>Current values</p>

          <div style={styles.summaryList}>
            <SummaryItem label="Display name" value={displayName || "Not set"} />
            <SummaryItem label="Tagline" value={tagline || "Not set"} />
            <SummaryItem label="Logo URL" value={logoUrl || "Not set"} />
            <SummaryItem label="Logo mark URL" value={logoMarkUrl || "Not set"} />
            <SummaryItem label="Primary colour" value={primaryColour} />
            <SummaryItem label="Accent colour" value={accentColour} />
            <SummaryItem label="Footer text" value={footerText || "Not set"} />
          </div>

          <Link
            href={`/c/${tenantSlug}?adminReturn=${encodeURIComponent(
              "/admin/settings/branding",
            )}`}
            target="_blank"
            style={styles.previewButton}
          >
            View public hub →
          </Link>
        </aside>
      </section>
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.summaryItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const responsiveStyles = `
.branding-settings-page,
.branding-settings-page * {
  box-sizing: border-box;
}

.branding-settings-page {
  overflow-x: hidden;
}

.branding-settings-page section,
.branding-settings-page div,
.branding-settings-page form,
.branding-settings-page label,
.branding-settings-page fieldset,
.branding-settings-page aside,
.branding-settings-page a {
  min-width: 0;
}

@media (max-width: 960px) {
  .branding-settings-page .branding-hero,
  .branding-settings-page .settings-grid {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 680px) {
  .branding-settings-page {
    padding: 18px 12px 44px !important;
  }

  .branding-settings-page .branding-hero,
  .branding-settings-page .form-card,
  .branding-settings-page .preview-card {
    padding: 18px !important;
    border-radius: 24px !important;
  }

  .branding-settings-page .branding-title {
    font-size: clamp(38px, 11vw, 58px) !important;
    line-height: 0.98 !important;
  }

  .branding-settings-page .colour-grid {
    grid-template-columns: 1fr !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: "28px 16px 64px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(37,99,235,0.10), transparent 34%), radial-gradient(circle at top right, rgba(250,204,21,0.08), transparent 30%), #f8fafc",
    color: "#0f172a",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.85fr)",
    gap: 22,
    padding: 30,
    borderRadius: 34,
    background:
      "radial-gradient(circle at bottom right, rgba(37,99,235,0.22), transparent 38%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 28px 70px rgba(15,23,42,0.22)",
    overflow: "hidden",
    border: "1px solid rgba(148,163,184,0.22)",
  },

  backLink: {
    display: "inline-flex",
    width: "fit-content",
    maxWidth: "100%",
    marginBottom: 16,
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
  },

  badgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 14,
  },

  badge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(251,191,36,0.16)",
    color: "#fef3c7",
    border: "1px solid rgba(251,191,36,0.32)",
    fontSize: 13,
    fontWeight: 950,
  },

  softBadge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    color: "#dbeafe",
    border: "1px solid rgba(191,219,254,0.26)",
    fontSize: 13,
    fontWeight: 950,
  },

  title: {
    margin: 0,
    color: "#ffffff",
    fontSize: "clamp(52px, 7vw, 82px)",
    lineHeight: 0.92,
    letterSpacing: "-0.08em",
    overflowWrap: "anywhere",
    textShadow: "0 18px 45px rgba(0,0,0,0.22)",
  },

  subtitle: {
    margin: "18px 0 0",
    maxWidth: 760,
    color: "#dbeafe",
    fontSize: 18,
    lineHeight: 1.6,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  tenant: {
    margin: "16px 0 0",
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  heroPanel: {
    display: "grid",
    gap: 12,
    alignContent: "start",
    padding: 18,
    borderRadius: 24,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.26)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
    backdropFilter: "blur(12px)",
  },

  heroPanelEyebrow: {
    margin: 0,
    color: "#facc15",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  previewLogoWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 84,
    height: 84,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid rgba(255,255,255,0.28)",
    overflow: "hidden",
  },

  previewLogo: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    padding: 10,
  },

  previewLogoFallback: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  heroPanelTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 26,
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  heroPanelText: {
    margin: 0,
    color: "#dbeafe",
    lineHeight: 1.55,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  colourPreviewRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  colourPreview: {
    display: "inline-flex",
    width: 36,
    height: 36,
    borderRadius: 999,
    border: "2px solid rgba(255,255,255,0.75)",
  },

  successCard: {
    display: "grid",
    gap: 4,
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #86efac",
    fontWeight: 800,
  },

  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.1fr) minmax(300px, 0.9fr)",
    gap: 16,
  },

  formCard: {
    display: "grid",
    gap: 14,
    padding: 22,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
  },

  kicker: {
    margin: 0,
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
    lineHeight: 1.05,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  sectionText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.6,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  form: {
    display: "grid",
    gap: 14,
  },

  field: {
    display: "grid",
    gap: 8,
  },

  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
  },

  input: {
    width: "100%",
    minHeight: 50,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "12px 13px",
    fontSize: 16,
    fontWeight: 750,
  },

  hint: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 700,
  },

  divider: {
    height: 1,
    background: "#e2e8f0",
    margin: "4px 0",
  },

  advancedHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },

  planPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
  },

  planPillIncluded: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #86efac",
  },

  planPillLocked: {
    background: "#ffedd5",
    color: "#9a3412",
    border: "1px solid #fdba74",
  },

  fieldset: {
    display: "grid",
    gap: 14,
    padding: 0,
    margin: 0,
    border: "none",
  },

  disabledFieldset: {
    opacity: 0.55,
  },

  colourGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  lockedNotice: {
    display: "grid",
    gap: 5,
    padding: 14,
    borderRadius: 18,
    background: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fed7aa",
    lineHeight: 1.5,
    fontSize: 14,
    fontWeight: 750,
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    minHeight: 48,
    padding: "12px 18px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "none",
    fontSize: 15,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(22,131,248,0.22)",
  },

  previewCard: {
    display: "grid",
    gap: 14,
    alignContent: "start",
    padding: 22,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 58%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    boxShadow: "0 8px 30px rgba(15,23,42,0.04)",
  },

  summaryList: {
    display: "grid",
    gap: 10,
  },

  summaryItem: {
    display: "grid",
    gap: 4,
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    color: "#334155",
    overflowWrap: "anywhere",
  },

  previewButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    minHeight: 44,
    padding: "11px 16px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
  },
};
