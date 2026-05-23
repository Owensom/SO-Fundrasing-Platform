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
import BrandingSettingsForm from "./BrandingSettingsForm";

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
  public_contact_name: string | null;
  public_contact_email: string | null;
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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function cleanEmail(value: unknown) {
  const clean = cleanLimitedText(value, 254).toLowerCase();

  if (!clean) return "";

  return isValidEmail(clean) ? clean : "";
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
  const clean = cleanText(value).toUpperCase();

  if (!clean) return "";

  if (/^#[0-9A-F]{6}$/.test(clean)) {
    return clean;
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
        public_contact_name,
        public_contact_email,
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

  const nextContactName = cleanLimitedText(
    formData.get("public_contact_name"),
    120,
  );

  const rawContactEmail = cleanLimitedText(
    formData.get("public_contact_email"),
    254,
  ).toLowerCase();

  if (rawContactEmail && !isValidEmail(rawContactEmail)) {
    redirect("/admin/settings/branding?error=invalid_contact_email");
  }

  const nextContactEmail = cleanEmail(rawContactEmail);

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
        public_contact_name,
        public_contact_email,
        public_logo_url,
        public_logo_mark_url,
        public_primary_colour,
        public_accent_colour,
        public_footer_text
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      on conflict (tenant_slug)
      do update set
        public_display_name = excluded.public_display_name,
        public_tagline = excluded.public_tagline,
        public_contact_name = excluded.public_contact_name,
        public_contact_email = excluded.public_contact_email,
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
      nextContactName || null,
      nextContactEmail || null,
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
  revalidatePath(`/c/${tenantSlug}/support`);
  revalidatePath(`/c/${tenantSlug}/contact`);
  redirect("/admin/settings/branding?saved=1");
}

export default async function AdminBrandingSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    saved?: string;
    error?: string;
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

  return (
    <BrandingSettingsForm
      tenantSlug={tenantSlug}
      subscriptionLabel={`${getTierLabel(subscriptionTier)} plan`}
      saved={resolvedSearchParams.saved === "1"}
      error={resolvedSearchParams.error || ""}
      canUseAdvancedBranding={canUseAdvancedBranding}
      formState={{
        displayName: settings?.public_display_name || "",
        tagline: settings?.public_tagline || "",
        contactName: settings?.public_contact_name || "",
        contactEmail: settings?.public_contact_email || "",
        logoUrl: settings?.public_logo_url || "",
        logoMarkUrl: settings?.public_logo_mark_url || "",
        primaryColour: settings?.public_primary_colour || "#1683F8",
        accentColour: settings?.public_accent_colour || "#FACC15",
        footerText: settings?.public_footer_text || "",
      }}
      updateAction={updateTenantBranding}
    />
  );
}
