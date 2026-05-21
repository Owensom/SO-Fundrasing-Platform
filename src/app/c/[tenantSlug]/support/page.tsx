import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { queryOne } from "@/lib/db";
import { normalizeTenantSlug } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    tenantSlug: string;
  }>;
  searchParams?: Promise<{
    campaignType?: string;
    campaignId?: string;
    donation?: string;
  }>;
};

type CampaignType = "raffle" | "squares" | "event" | "auction" | "general";

type CampaignLookup = {
  id: string;
  title: string;
  slug: string | null;
  currency: string | null;
  description: string | null;
  image_url: string | null;
};

function cleanText(value: unknown, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function cleanCampaignType(value: unknown): CampaignType {
  const clean = cleanText(value).toLowerCase();

  if (
    clean === "raffle" ||
    clean === "squares" ||
    clean === "event" ||
    clean === "auction"
  ) {
    return clean;
  }

  return "general";
}

function campaignTypeLabel(type: CampaignType) {
  if (type === "raffle") return "Raffle";
  if (type === "squares") return "Squares";
  if (type === "event") return "Event";
  if (type === "auction") return "Auction";
  return "General support";
}

function getCampaignPublicHref(type: CampaignType, slug: string | null) {
  if (!slug) return "";

  if (type === "raffle") return `/r/${slug}`;
  if (type === "squares") return `/s/${slug}`;
  if (type === "event") return `/e/${slug}`;
  if (type === "auction") return `/a/${slug}`;

  return "";
}

async function lookupCampaign(params: {
  tenantSlug: string;
  campaignType: CampaignType;
  campaignId: string;
}): Promise<CampaignLookup | null> {
  if (!params.campaignId || params.campaignType === "general") {
    return null;
  }

  if (params.campaignType === "raffle") {
    return queryOne<CampaignLookup>(
      `
        select
          id::text as id,
          title,
          slug,
          currency,
          description,
          image_url
        from raffles
        where id::text = $1
          and tenant_slug = $2
        limit 1
      `,
      [params.campaignId, params.tenantSlug],
    );
  }

  if (params.campaignType === "squares") {
    return queryOne<CampaignLookup>(
      `
        select
          id::text as id,
          title,
          slug,
          currency,
          description,
          image_url
        from squares_games
        where id::text = $1
          and tenant_slug = $2
        limit 1
      `,
      [params.campaignId, params.tenantSlug],
    );
  }

  if (params.campaignType === "event") {
    return queryOne<CampaignLookup>(
      `
        select
          id::text as id,
          title,
          slug,
          currency,
          description,
          image_url
        from events
        where id::text = $1
          and tenant_slug = $2
        limit 1
      `,
      [params.campaignId, params.tenantSlug],
    );
  }

  if (params.campaignType === "auction") {
    return queryOne<CampaignLookup>(
      `
        select
          id::text as id,
          title,
          slug,
          currency,
          description,
          image_url
        from silent_auctions
        where id::text = $1
          and tenant_slug = $2
        limit 1
      `,
      [params.campaignId, params.tenantSlug],
    );
  }

  return null;
}

function getStatusMessage(value: string | undefined) {
  if (value === "success") {
    return {
      tone: "success" as const,
      title: "Thank you — your donation was successful.",
      text: "Your support has been received securely through Stripe.",
    };
  }

  if (value === "cancelled") {
    return {
      tone: "warning" as const,
      title: "Donation checkout was cancelled.",
      text: "No payment was taken. You can try again below.",
    };
  }

  return null;
}

export default async function PublicSupportPage({
  params,
  searchParams,
}: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const tenantSlug = normalizeTenantSlug(resolvedParams.tenantSlug);
  const campaignType = cleanCampaignType(resolvedSearchParams.campaignType);
  const campaignId = cleanText(resolvedSearchParams.campaignId);
  const statusMessage = getStatusMessage(resolvedSearchParams.donation);

  if (!tenantSlug) {
    notFound();
  }

  const campaign = await lookupCampaign({
    tenantSlug,
    campaignType,
    campaignId,
  });

  if (campaignType !== "general" && campaignId && !campaign) {
    notFound();
  }

  const campaignTitle =
    campaign?.title ||
    (campaignType === "general"
      ? "Support this cause"
      : "Support this campaign");

  const currency = cleanText(campaign?.currency, "GBP").toUpperCase();
  const publicHref = getCampaignPublicHref(campaignType, campaign?.slug || null);

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <Link href={`/c/${tenantSlug}`} style={styles.backLink}>
            ← Back to campaigns
          </Link>

          <div style={styles.badgeRow}>
            <span style={styles.badge}>Support campaign</span>
            <span style={styles.softBadge}>{campaignTypeLabel(campaignType)}</span>
          </div>

          <h1 style={styles.title}>{campaignTitle}</h1>

          <p style={styles.subtitle}>
            Make a simple donation to support this cause. This is separate from
            buying raffle tickets, squares, event tickets or auction bids.
          </p>

          {publicHref ? (
            <Link href={publicHref} style={styles.viewCampaignLink}>
              View campaign page
            </Link>
          ) : null}
        </div>

        <div style={styles.heroPanel}>
          <div style={styles.panelEyebrow}>Pure donation</div>
          <h2 style={styles.panelTitle}>No draw entry. No bid. No ticket.</h2>
          <p style={styles.panelText}>
            This payment is treated as a straightforward donation through the
            platform donation flow.
          </p>
        </div>
      </section>

      {statusMessage ? (
        <section
          style={{
            ...styles.statusCard,
            ...(statusMessage.tone === "success"
              ? styles.successCard
              : styles.warningCard),
          }}
        >
          <h2 style={styles.statusTitle}>{statusMessage.title}</h2>
          <p style={styles.statusText}>{statusMessage.text}</p>
        </section>
      ) : null}

      <section style={styles.contentGrid}>
        <section style={styles.formCard}>
          <div style={styles.sectionEyebrow}>Donation details</div>
          <h2 style={styles.sectionTitle}>Choose your support amount</h2>

          <form
            action="/api/stripe/checkout/donation"
            method="post"
            style={styles.form}
          >
            <input type="hidden" name="tenantSlug" value={tenantSlug} />
            <input type="hidden" name="campaignType" value={campaignType} />
            <input type="hidden" name="campaignId" value={campaign?.id || campaignId} />
            <input type="hidden" name="campaignTitle" value={campaignTitle} />
            <input type="hidden" name="currency" value={currency} />

            <label style={styles.field}>
              <span style={styles.label}>Donation amount ({currency})</span>
              <select name="amount" defaultValue="10.00" required style={styles.input}>
                <option value="5.00">£5</option>
                <option value="10.00">£10</option>
                <option value="25.00">£25</option>
                <option value="50.00">£50</option>
                <option value="100.00">£100</option>
              </select>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Your name</span>
              <input
                name="donorName"
                autoComplete="name"
                placeholder="Optional"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Email address</span>
              <input
                name="donorEmail"
                type="email"
                autoComplete="email"
                required
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Message</span>
              <textarea
                name="message"
                rows={4}
                placeholder="Optional message for the organiser"
                style={styles.textarea}
              />
            </label>

            <button type="submit" style={styles.primaryButton}>
              Continue to secure payment
            </button>
          </form>
        </section>
        import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { queryOne } from "@/lib/db";
import { normalizeTenantSlug } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    tenantSlug: string;
  }>;
  searchParams?: Promise<{
    campaignType?: string;
    campaignId?: string;
    donation?: string;
  }>;
};

type CampaignType = "raffle" | "squares" | "event" | "auction" | "general";

type CampaignLookup = {
  id: string;
  title: string;
  slug: string | null;
  currency: string | null;
  description: string | null;
  image_url: string | null;
};

function cleanText(value: unknown, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function cleanCampaignType(value: unknown): CampaignType {
  const clean = cleanText(value).toLowerCase();

  if (
    clean === "raffle" ||
    clean === "squares" ||
    clean === "event" ||
    clean === "auction"
  ) {
    return clean;
  }

  return "general";
}

function campaignTypeLabel(type: CampaignType) {
  if (type === "raffle") return "Raffle";
  if (type === "squares") return "Squares";
  if (type === "event") return "Event";
  if (type === "auction") return "Auction";
  return "General support";
}

function getCampaignPublicHref(type: CampaignType, slug: string | null) {
  if (!slug) return "";

  if (type === "raffle") return `/r/${slug}`;
  if (type === "squares") return `/s/${slug}`;
  if (type === "event") return `/e/${slug}`;
  if (type === "auction") return `/a/${slug}`;

  return "";
}

async function lookupCampaign(params: {
  tenantSlug: string;
  campaignType: CampaignType;
  campaignId: string;
}): Promise<CampaignLookup | null> {
  if (!params.campaignId || params.campaignType === "general") {
    return null;
  }

  if (params.campaignType === "raffle") {
    return queryOne<CampaignLookup>(
      `
        select
          id::text as id,
          title,
          slug,
          currency,
          description,
          image_url
        from raffles
        where id::text = $1
          and tenant_slug = $2
        limit 1
      `,
      [params.campaignId, params.tenantSlug],
    );
  }

  if (params.campaignType === "squares") {
    return queryOne<CampaignLookup>(
      `
        select
          id::text as id,
          title,
          slug,
          currency,
          description,
          image_url
        from squares_games
        where id::text = $1
          and tenant_slug = $2
        limit 1
      `,
      [params.campaignId, params.tenantSlug],
    );
  }

  if (params.campaignType === "event") {
    return queryOne<CampaignLookup>(
      `
        select
          id::text as id,
          title,
          slug,
          currency,
          description,
          image_url
        from events
        where id::text = $1
          and tenant_slug = $2
        limit 1
      `,
      [params.campaignId, params.tenantSlug],
    );
  }

  if (params.campaignType === "auction") {
    return queryOne<CampaignLookup>(
      `
        select
          id::text as id,
          title,
          slug,
          currency,
          description,
          image_url
        from silent_auctions
        where id::text = $1
          and tenant_slug = $2
        limit 1
      `,
      [params.campaignId, params.tenantSlug],
    );
  }

  return null;
}

function getStatusMessage(value: string | undefined) {
  if (value === "success") {
    return {
      tone: "success" as const,
      title: "Thank you — your donation was successful.",
      text: "Your support has been received securely through Stripe.",
    };
  }

  if (value === "cancelled") {
    return {
      tone: "warning" as const,
      title: "Donation checkout was cancelled.",
      text: "No payment was taken. You can try again below.",
    };
  }

  return null;
}

export default async function PublicSupportPage({
  params,
  searchParams,
}: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const tenantSlug = normalizeTenantSlug(resolvedParams.tenantSlug);
  const campaignType = cleanCampaignType(resolvedSearchParams.campaignType);
  const campaignId = cleanText(resolvedSearchParams.campaignId);
  const statusMessage = getStatusMessage(resolvedSearchParams.donation);

  if (!tenantSlug) {
    notFound();
  }

  const campaign = await lookupCampaign({
    tenantSlug,
    campaignType,
    campaignId,
  });

  if (campaignType !== "general" && campaignId && !campaign) {
    notFound();
  }

  const campaignTitle =
    campaign?.title ||
    (campaignType === "general"
      ? "Support this cause"
      : "Support this campaign");

  const currency = cleanText(campaign?.currency, "GBP").toUpperCase();
  const publicHref = getCampaignPublicHref(campaignType, campaign?.slug || null);

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <Link href={`/c/${tenantSlug}`} style={styles.backLink}>
            ← Back to campaigns
          </Link>

          <div style={styles.badgeRow}>
            <span style={styles.badge}>Support campaign</span>
            <span style={styles.softBadge}>{campaignTypeLabel(campaignType)}</span>
          </div>

          <h1 style={styles.title}>{campaignTitle}</h1>

          <p style={styles.subtitle}>
            Make a simple donation to support this cause. This is separate from
            buying raffle tickets, squares, event tickets or auction bids.
          </p>

          {publicHref ? (
            <Link href={publicHref} style={styles.viewCampaignLink}>
              View campaign page
            </Link>
          ) : null}
        </div>

        <div style={styles.heroPanel}>
          <div style={styles.panelEyebrow}>Pure donation</div>
          <h2 style={styles.panelTitle}>No draw entry. No bid. No ticket.</h2>
          <p style={styles.panelText}>
            This payment is treated as a straightforward donation through the
            platform donation flow.
          </p>
        </div>
      </section>

      {statusMessage ? (
        <section
          style={{
            ...styles.statusCard,
            ...(statusMessage.tone === "success"
              ? styles.successCard
              : styles.warningCard),
          }}
        >
          <h2 style={styles.statusTitle}>{statusMessage.title}</h2>
          <p style={styles.statusText}>{statusMessage.text}</p>
        </section>
      ) : null}

      <section style={styles.contentGrid}>
        <section style={styles.formCard}>
          <div style={styles.sectionEyebrow}>Donation details</div>
          <h2 style={styles.sectionTitle}>Choose your support amount</h2>

          <form
            action="/api/stripe/checkout/donation"
            method="post"
            style={styles.form}
          >
            <input type="hidden" name="tenantSlug" value={tenantSlug} />
            <input type="hidden" name="campaignType" value={campaignType} />
            <input type="hidden" name="campaignId" value={campaign?.id || campaignId} />
            <input type="hidden" name="campaignTitle" value={campaignTitle} />
            <input type="hidden" name="currency" value={currency} />

            <label style={styles.field}>
              <span style={styles.label}>Donation amount ({currency})</span>
              <select name="amount" defaultValue="10.00" required style={styles.input}>
                <option value="5.00">£5</option>
                <option value="10.00">£10</option>
                <option value="25.00">£25</option>
                <option value="50.00">£50</option>
                <option value="100.00">£100</option>
              </select>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Your name</span>
              <input
                name="donorName"
                autoComplete="name"
                placeholder="Optional"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Email address</span>
              <input
                name="donorEmail"
                type="email"
                autoComplete="email"
                required
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Message</span>
              <textarea
                name="message"
                rows={4}
                placeholder="Optional message for the organiser"
                style={styles.textarea}
              />
            </label>

            <button type="submit" style={styles.primaryButton}>
              Continue to secure payment
            </button>
          </form>
        </section>
