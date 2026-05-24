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
import { sendTenantContactTestEmail } from "@/lib/customer-contact-email";
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
  public_contact_email_verified_at: string | Date | null;
  public_contact_email_verification_sent_at: string | Date | null;
  public_contact_email_verification_status: string | null;
  public_contact_email_verification_error: string | null;
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
        public_contact_email_verified_at,
        public_contact_email_verification_sent_at,
        public_contact_email_verification_status,
        public_contact_email_verification_error,
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
        public_contact_email_verification_status,
        public_contact_email_verification_sent_at,
        public_contact_email_verified_at,
        public_contact_email_verification_error,
        public_logo_url,
        public_logo_mark_url,
        public_primary_colour,
        public_accent_colour,
        public_footer_text
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        case when $5::text is null then null else 'not_sent' end,
        null,
        null,
        null,
        $6,
        $7,
        $8,
        $9,
        $10
      )
      on conflict (tenant_slug)
      do update set
        public_display_name = excluded.public_display_name,
        public_tagline = excluded.public_tagline,
        public_contact_name = excluded.public_contact_name,
        public_contact_email = excluded.public_contact_email,
        public_contact_email_verification_status =
          case
            when tenant_settings.public_contact_email is distinct from excluded.public_contact_email
              then case
                when excluded.public_contact_email is null then null
                else 'not_sent'
              end
            else tenant_settings.public_contact_email_verification_status
          end,
        public_contact_email_verification_sent_at =
          case
            when tenant_settings.public_contact_email is distinct from excluded.public_contact_email
              then null
            else tenant_settings.public_contact_email_verification_sent_at
          end,
        public_contact_email_verified_at =
          case
            when tenant_settings.public_contact_email is distinct from excluded.public_contact_email
              then null
            else tenant_settings.public_contact_email_verified_at
          end,
        public_contact_email_verification_error =
          case
            when tenant_settings.public_contact_email is distinct from excluded.public_contact_email
              then null
            else tenant_settings.public_contact_email_verification_error
          end,
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

async function sendContactEmailTest(formData: FormData) {
  "use server";

  const access = await requireCurrentTenantAccess();
  const tenantSlug = access.tenantSlug;

  const settings = await getBrandingSettings(tenantSlug);
  const contactEmail = cleanEmail(settings?.public_contact_email);

  if (!settings) {
    redirect("/admin/settings/branding?contactTest=missing_settings");
  }

  if (!contactEmail) {
    redirect("/admin/settings/branding?contactTest=missing_contact_email");
  }

  try {
    await sendTenantContactTestEmail({
      tenantSlug,
      tenantDisplayName: cleanText(settings.public_display_name) || tenantSlug,
      tenantContactEmail: contactEmail,
      tenantContactName: settings.public_contact_name,
    });

    await query(
      `
        update tenant_settings
        set
          public_contact_email_verification_status = 'sent',
          public_contact_email_verification_sent_at = now(),
          public_contact_email_verified_at = null,
          public_contact_email_verification_error = null,
          updated_at = now()
        where tenant_slug = $1
          and public_contact_email = $2
      `,
      [tenantSlug, contactEmail],
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message.slice(0, 1000)
        : "Contact email test failed";

    console.error("Tenant contact test email failed", error);

    await query(
      `
        update tenant_settings
        set
          public_contact_email_verification_status = 'failed',
          public_contact_email_verification_error = $2,
          updated_at = now()
        where tenant_slug = $1
      `,
      [tenantSlug, errorMessage],
    );

    redirect("/admin/settings/branding?contactTest=email_failed");
  }

  revalidatePath("/admin/settings/branding");
  redirect("/admin/settings/branding?contactTest=sent");
}

export default async function AdminBrandingSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    saved?: string;
    error?: string;
    contactTest?: string;
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
      contactTest={resolvedSearchParams.contactTest || ""}
      canUseAdvancedBranding={canUseAdvancedBranding}
      formState={{
        displayName: settings?.public_display_name || "",
        tagline: settings?.public_tagline || "",
        contactName: settings?.public_contact_name || "",
        contactEmail: settings?.public_contact_email || "",
        contactEmailVerificationStatus:
          settings?.public_contact_email_verification_status || "",
        contactEmailVerificationSentAt:
          settings?.public_contact_email_verification_sent_at
            ? String(settings.public_contact_email_verification_sent_at)
            : "",
        contactEmailVerifiedAt: settings?.public_contact_email_verified_at
          ? String(settings.public_contact_email_verified_at)
          : "",
        contactEmailVerificationError:
          settings?.public_contact_email_verification_error || "",
        logoUrl: settings?.public_logo_url || "",
        logoMarkUrl: settings?.public_logo_mark_url || "",
        primaryColour: settings?.public_primary_colour || "#1683F8",
        accentColour: settings?.public_accent_colour || "#FACC15",
        footerText: settings?.public_footer_text || "",
      }}
      updateAction={updateTenantBranding}
      sendContactEmailTestAction={sendContactEmailTest}
    />
  );
}
