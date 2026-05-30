import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import {
  getTierLabel,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";
import { listAuctions } from "../../../../api/_lib/auctions-repo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type JsonRecord = Record<string, unknown>;

type TenantLaunchSettings = {
  tenant_slug: string;
  subscription_tier: string;
  subscription_status: string;
  platform_owner_bypass: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_connect_account_id: string | null;
  buyer_fee_contributions_enabled: boolean;
  gift_aid_enabled: boolean;
  charity_registration_type: string | null;
  charity_registration_number: string | null;
  highlighted_campaign_type: string | null;
  highlighted_campaign_id: string | null;
  public_display_name: string | null;
  public_tagline: string | null;
  public_logo_url: string | null;
  public_logo_mark_url: string | null;
  public_primary_colour: string | null;
  public_accent_colour: string | null;
  public_footer_text: string | null;
  public_contact_email: string | null;
  public_contact_name: string | null;
  public_contact_email_verified_at: string | null;
  public_contact_email_verification_status: string | null;
};

type RaffleReadinessRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  ticket_price_cents: number;
  total_tickets: number;
  sold_tickets: number;
  draw_at: string | null;
  raffle_subtype: string;
  config_json: JsonRecord;
};

type SquaresReadinessRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  price_per_square_cents: number;
  total_squares: number;
  draw_at: string | null;
  config_json: JsonRecord;
};

type EventReadinessRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  starts_at: string | null;
  event_type: string;
  event_subtype: string;
  event_addons_json: unknown;
};

type CountRow = {
  count: number | string;
};

type MoneyRow = {
  count: number | string;
  total_cents: number | string | null;
};

type SupportSummaryRow = {
  count: number | string;
  open_count: number | string;
};

type ReadinessTone = "good" | "warning" | "danger" | "neutral";

type ReadinessItem = {
  title: string;
  status: string;
  detail: string;
  tone: ReadinessTone;
  href?: string;
  action?: string;
};

type CampaignWarning = {
  title: string;
  detail: string;
  href: string;
  tone: ReadinessTone;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function asCount(value: unknown) {
  const number = Number(value || 0);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.floor(number);
}

function formatMoney(cents: unknown, currency = "GBP") {
  const value = Number(cents || 0);

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
    }).format(value / 100);
  } catch {
    return `£${(value / 100).toFixed(2)}`;
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isPastDate(value: string | null | undefined) {
  if (!value) return false;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return false;

  return date.getTime() < Date.now();
}

function getNestedRecord(source: JsonRecord, key: string) {
  const value = source[key];

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }

  return {};
}

function booleanFromConfig(source: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key];

    if (value === true || value === "true" || value === 1 || value === "1") {
      return true;
    }

    if (
      value === false ||
      value === "false" ||
      value === 0 ||
      value === "0"
    ) {
      return false;
    }
  }

  return false;
}

function stringFromConfig(source: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = cleanText(source[key]);

    if (value) return value;
  }

  return "";
}

function hasLegalQuestionEnabled(config: JsonRecord) {
  const entryQuestion = getNestedRecord(config, "entryQuestion");
  const legalQuestion = getNestedRecord(config, "legalQuestion");

  return (
    booleanFromConfig(config, [
      "entryQuestionEnabled",
      "entry_question_enabled",
      "legalQuestionEnabled",
      "legal_question_enabled",
      "questionEnabled",
      "question_enabled",
    ]) ||
    booleanFromConfig(entryQuestion, ["enabled", "isEnabled"]) ||
    booleanFromConfig(legalQuestion, ["enabled", "isEnabled"])
  );
}

function hasLegalQuestionAnswer(config: JsonRecord) {
  const entryQuestion = getNestedRecord(config, "entryQuestion");
  const legalQuestion = getNestedRecord(config, "legalQuestion");

  return Boolean(
    stringFromConfig(config, [
      "entryQuestionAnswer",
      "entry_question_answer",
      "legalQuestionAnswer",
      "legal_question_answer",
      "correctAnswer",
      "correct_answer",
      "answer",
    ]) ||
      stringFromConfig(entryQuestion, ["answer", "correctAnswer", "correct_answer"]) ||
      stringFromConfig(legalQuestion, ["answer", "correctAnswer", "correct_answer"]),
  );
}

function hasPostalEntryInfo(config: JsonRecord) {
  const postal = getNestedRecord(config, "postalEntry");
  const freeEntry = getNestedRecord(config, "freePostalEntry");

  return Boolean(
    stringFromConfig(config, [
      "postalEntryAddress",
      "postal_entry_address",
      "freePostalEntryAddress",
      "free_postal_entry_address",
      "postalAddress",
      "postal_address",
    ]) ||
      stringFromConfig(postal, ["address", "instructions"]) ||
      stringFromConfig(freeEntry, ["address", "instructions"]),
  );
}

function getEnabledEventAddOns(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.filter((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return false;
    }

    return Boolean((item as JsonRecord).enabled);
  });
}

function readinessToneStyle(tone: ReadinessTone): CSSProperties {
  if (tone === "good") {
    return {
      background: "#f0fdf4",
      borderColor: "#bbf7d0",
      color: "#166534",
    };
  }

  if (tone === "warning") {
    return {
      background: "#fffbeb",
      borderColor: "#fde68a",
      color: "#92400e",
    };
  }

  if (tone === "danger") {
    return {
      background: "#fef2f2",
      borderColor: "#fecaca",
      color: "#991b1b",
    };
  }

  return {
    background: "#f8fafc",
    borderColor: "#e2e8f0",
    color: "#475569",
  };
}

function statusLabel(tone: ReadinessTone) {
  if (tone === "good") return "Ready";
  if (tone === "warning") return "Check";
  if (tone === "danger") return "Needs action";
  return "Info";
}

function scoreReadiness(items: ReadinessItem[]) {
  const scoredItems = items.filter((item) => item.tone !== "neutral");

  if (scoredItems.length === 0) return 0;

  const ready = scoredItems.filter((item) => item.tone === "good").length;

  return Math.round((ready / scoredItems.length) * 100);
}

function getOverallTone(score: number): ReadinessTone {
  if (score >= 85) return "good";
  if (score >= 60) return "warning";
  return "danger";
}

async function requireTenantAccess() {
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

  return tenantSlug;
}

async function getTenantLaunchSettings(tenantSlug: string) {
  return queryOne<TenantLaunchSettings>(
    `
      select
        tenant_slug,
        subscription_tier,
        subscription_status,
        platform_owner_bypass,
        stripe_customer_id,
        stripe_subscription_id,
        stripe_connect_account_id,
        buyer_fee_contributions_enabled,
        gift_aid_enabled,
        charity_registration_type,
        charity_registration_number,
        highlighted_campaign_type,
        highlighted_campaign_id,
        public_display_name,
        public_tagline,
        public_logo_url,
        public_logo_mark_url,
        public_primary_colour,
        public_accent_colour,
        public_footer_text,
        public_contact_email,
        public_contact_name,
        public_contact_email_verified_at::text,
        public_contact_email_verification_status
      from tenant_settings
      where tenant_slug = $1
      limit 1
    `,
    [tenantSlug],
  );
}

async function getRaffles(tenantSlug: string) {
  return query<RaffleReadinessRow>(
    `
      select
        id,
        slug,
        title,
        status,
        ticket_price_cents,
        total_tickets,
        sold_tickets,
        draw_at::text,
        raffle_subtype,
        config_json
      from raffles
      where tenant_slug = $1
      order by created_at desc
    `,
    [tenantSlug],
  );
}

async function getSquares(tenantSlug: string) {
  return query<SquaresReadinessRow>(
    `
      select
        id,
        slug,
        title,
        status,
        price_per_square_cents,
        total_squares,
        draw_at::text,
        config_json
      from squares_games
      where tenant_slug = $1
      order by created_at desc
    `,
    [tenantSlug],
  );
}

async function getEvents(tenantSlug: string) {
  return query<EventReadinessRow>(
    `
      select
        id::text,
        slug,
        title,
        status,
        starts_at::text,
        event_type,
        event_subtype,
        event_addons_json
      from events
      where tenant_slug = $1
      order by created_at desc
    `,
    [tenantSlug],
  );
}

async function getPaidDonationSummary(tenantSlug: string) {
  return queryOne<MoneyRow>(
    `
      select
        count(*) as count,
        coalesce(sum(amount_cents), 0) as total_cents
      from public_donations
      where tenant_slug = $1
        and payment_status = 'paid'
    `,
    [tenantSlug],
  );
}

async function getPaidEventOrderSummary(tenantSlug: string) {
  return queryOne<MoneyRow>(
    `
      select
        count(*) as count,
        coalesce(sum(amount_total), 0) as total_cents
      from event_orders
      where tenant_slug = $1
        and status = 'paid'
    `,
    [tenantSlug],
  );
}

async function getSupportSummary(tenantSlug: string) {
  return queryOne<SupportSummaryRow>(
    `
      select
        count(*) as count,
        count(*) filter (
          where status in ('new', 'open', 'in_progress')
        ) as open_count
      from support_requests
      where tenant_slug = $1
    `,
    [tenantSlug],
  );
}
function buildRaffleWarnings(raffles: RaffleReadinessRow[]) {
  const warnings: CampaignWarning[] = [];

  for (const raffle of raffles) {
    const href = `/admin/raffles/${encodeURIComponent(raffle.id)}`;

    if (raffle.status === "published" && Number(raffle.ticket_price_cents || 0) <= 0) {
      warnings.push({
        title: `${raffle.title}: ticket price missing`,
        detail: "Published raffles should have a valid ticket price before sharing.",
        href,
        tone: "danger",
      });
    }

    if (raffle.status === "published" && Number(raffle.total_tickets || 0) <= 0) {
      warnings.push({
        title: `${raffle.title}: ticket range missing`,
        detail: "Published raffles should have a valid ticket allocation.",
        href,
        tone: "danger",
      });
    }

    if (raffle.status === "published" && !raffle.draw_at) {
      warnings.push({
        title: `${raffle.title}: draw date not set`,
        detail: "A visible draw date helps supporters understand when the raffle closes.",
        href,
        tone: "warning",
      });
    }

    if (
      raffle.status === "published" &&
      hasLegalQuestionEnabled(raffle.config_json || {}) &&
      !hasLegalQuestionAnswer(raffle.config_json || {})
    ) {
      warnings.push({
        title: `${raffle.title}: legal question answer missing`,
        detail: "The raffle has a legal question enabled, but no answer was found in the saved configuration.",
        href,
        tone: "danger",
      });
    }

    if (raffle.status === "published" && !hasPostalEntryInfo(raffle.config_json || {})) {
      warnings.push({
        title: `${raffle.title}: postal entry details not detected`,
        detail: "Check that free postal entry information is present before launch.",
        href,
        tone: "warning",
      });
    }
  }

  return warnings;
}

function buildSquaresWarnings(squares: SquaresReadinessRow[]) {
  const warnings: CampaignWarning[] = [];

  for (const game of squares) {
    const href = `/admin/squares/${encodeURIComponent(game.id)}`;

    if (game.status === "published" && Number(game.price_per_square_cents || 0) <= 0) {
      warnings.push({
        title: `${game.title}: square price missing`,
        detail: "Published squares games should have a valid price per square.",
        href,
        tone: "danger",
      });
    }

    if (game.status === "published" && Number(game.total_squares || 0) <= 0) {
      warnings.push({
        title: `${game.title}: grid size missing`,
        detail: "Published squares games should have a valid number of squares.",
        href,
        tone: "danger",
      });
    }

    if (game.status === "published" && !game.draw_at) {
      warnings.push({
        title: `${game.title}: draw date not set`,
        detail: "A draw date helps supporters understand when the game closes.",
        href,
        tone: "warning",
      });
    }

    if (
      game.status === "published" &&
      hasLegalQuestionEnabled(game.config_json || {}) &&
      !hasLegalQuestionAnswer(game.config_json || {})
    ) {
      warnings.push({
        title: `${game.title}: legal question answer missing`,
        detail: "The squares game has a legal question enabled, but no answer was found in the saved configuration.",
        href,
        tone: "danger",
      });
    }
  }

  return warnings;
}

function buildEventWarnings(events: EventReadinessRow[]) {
  const warnings: CampaignWarning[] = [];

  for (const event of events) {
    const href = `/admin/events/${encodeURIComponent(event.id)}`;
    const enabledAddOns = getEnabledEventAddOns(event.event_addons_json);

    if (event.status === "published" && !event.starts_at) {
      warnings.push({
        title: `${event.title}: event start date missing`,
        detail: "Published events should have a clear date and time before supporters book.",
        href,
        tone: "danger",
      });
    }

    if (event.status === "published" && isPastDate(event.starts_at)) {
      warnings.push({
        title: `${event.title}: event date is in the past`,
        detail: "Check whether this event should remain published or be closed.",
        href,
        tone: "warning",
      });
    }

    for (const addOn of enabledAddOns) {
      const addOnRecord = addOn as JsonRecord;
      const addOnType = cleanText(addOnRecord.type);
      const addOnTitle = cleanText(addOnRecord.title) || "Event add-on";
      const collectAtCheckout =
        addOnRecord.collectAtCheckout === true ||
        addOnRecord.collect_at_checkout === true;
      const entryPriceCents = Number(
        addOnRecord.entryPriceCents ?? addOnRecord.entry_price_cents ?? 0,
      );

      if (collectAtCheckout && (!Number.isFinite(entryPriceCents) || entryPriceCents <= 0)) {
        warnings.push({
          title: `${event.title}: ${addOnTitle} checkout price missing`,
          detail: "This add-on is set to collect at checkout but does not have a valid entry price.",
          href: `/admin/events/${encodeURIComponent(event.id)}/addons`,
          tone: "danger",
        });
      }

      if (addOnType === "higher_or_lower") {
        const prizeRevealEnabled =
          addOnRecord.prizeRevealModeEnabled === true ||
          addOnRecord.prize_reveal_mode_enabled === true;
        const prizeRevealPrizes = Array.isArray(addOnRecord.prizeRevealPrizes)
          ? addOnRecord.prizeRevealPrizes
          : Array.isArray(addOnRecord.prize_reveal_prizes)
            ? addOnRecord.prize_reveal_prizes
            : [];

        if (prizeRevealEnabled && prizeRevealPrizes.length < 2) {
          warnings.push({
            title: `${event.title}: Higher or Lower needs more prizes`,
            detail: "Prize reveal mode should have at least two valid prizes for one playable Higher or Lower round.",
            href: `/admin/events/${encodeURIComponent(event.id)}/addons`,
            tone: "warning",
          });
        }
      }
    }
  }

  return warnings;
}

function buildAuctionWarnings(auctions: Array<Record<string, unknown>>) {
  const warnings: CampaignWarning[] = [];

  for (const auction of auctions) {
    const id = cleanText(auction.id);
    const title = cleanText(auction.title) || "Auction";
    const status = cleanText(auction.status);
    const href = id ? `/admin/auctions/${encodeURIComponent(id)}` : "/admin/auctions";

    if (status === "published") {
      const closesAt = cleanText(auction.closes_at || auction.closesAt);

      if (closesAt && isPastDate(closesAt)) {
        warnings.push({
          title: `${title}: closing date is in the past`,
          detail: "Check whether this auction should remain published or be closed.",
          href,
          tone: "warning",
        });
      }
    }
  }

  return warnings;
}

function buildTenantReadinessItems(input: {
  tenantSlug: string;
  settings: TenantLaunchSettings | null;
  raffles: RaffleReadinessRow[];
  squares: SquaresReadinessRow[];
  events: EventReadinessRow[];
  auctions: Array<Record<string, unknown>>;
  donationSummary: MoneyRow | null;
  eventOrderSummary: MoneyRow | null;
  supportSummary: SupportSummaryRow | null;
  campaignWarnings: CampaignWarning[];
}): ReadinessItem[] {
  const settings = input.settings;
  const publishedRaffles = input.raffles.filter((item) => item.status === "published");
  const publishedSquares = input.squares.filter((item) => item.status === "published");
  const publishedEvents = input.events.filter((item) => item.status === "published");
  const publishedAuctions = input.auctions.filter(
    (item) => cleanText(item.status) === "published",
  );

  const totalPublishedCampaigns =
    publishedRaffles.length +
    publishedSquares.length +
    publishedEvents.length +
    publishedAuctions.length;

  const hasDisplayName = Boolean(cleanText(settings?.public_display_name));
  const hasLogo = Boolean(
    cleanText(settings?.public_logo_url) || cleanText(settings?.public_logo_mark_url),
  );
  const hasBrandColours = Boolean(
    cleanText(settings?.public_primary_colour) || cleanText(settings?.public_accent_colour),
  );
  const hasContactEmail = Boolean(cleanText(settings?.public_contact_email));
  const contactVerified = Boolean(settings?.public_contact_email_verified_at);
  const hasGiftAidRegistration =
    Boolean(settings?.gift_aid_enabled) &&
    Boolean(cleanText(settings?.charity_registration_type)) &&
    Boolean(cleanText(settings?.charity_registration_number));

  const paidDonationCount = asCount(input.donationSummary?.count);
  const paidEventOrderCount = asCount(input.eventOrderSummary?.count);
  const openSupportCount = asCount(input.supportSummary?.open_count);

  return [
    {
      title: "Public campaign hub",
      status: totalPublishedCampaigns > 0 ? "Campaigns published" : "No published campaigns",
      detail:
        totalPublishedCampaigns > 0
          ? `${totalPublishedCampaigns} published campaign${totalPublishedCampaigns === 1 ? "" : "s"} are available from the public hub.`
          : "Publish at least one campaign before sharing the public hub.",
      tone: totalPublishedCampaigns > 0 ? "good" : "warning",
      href: `/c/${input.tenantSlug}?adminReturn=${encodeURIComponent("/admin/launch-readiness")}`,
      action: "View public hub",
    },
    {
      title: "Brand identity",
      status: hasDisplayName && hasLogo && hasBrandColours ? "Branding ready" : "Branding incomplete",
      detail:
        hasDisplayName && hasLogo && hasBrandColours
          ? "Public display name, logo and colour settings are present."
          : "Complete the public display name, logo/logo mark and public colours for a stronger launch.",
      tone: hasDisplayName && hasLogo && hasBrandColours ? "good" : "warning",
      href: "/admin/settings/branding",
      action: "Open branding",
    },
    {
      title: "Public contact email",
      status: hasContactEmail ? (contactVerified ? "Verified" : "Email saved") : "Missing",
      detail: hasContactEmail
        ? contactVerified
          ? "The public contact email has been verified."
          : "A public contact email is saved, but verification is not complete or was not detected."
        : "Add a public contact email so supporters can contact the organiser.",
      tone: hasContactEmail ? (contactVerified ? "good" : "warning") : "danger",
      href: "/admin/settings/branding",
      action: "Open branding",
    },
    {
      title: "Donation and Gift Aid setup",
      status: settings?.gift_aid_enabled
        ? hasGiftAidRegistration
          ? "Gift Aid ready"
          : "Gift Aid needs registration details"
        : "Gift Aid off",
      detail: settings?.gift_aid_enabled
        ? hasGiftAidRegistration
          ? "Gift Aid is enabled and charity registration details are present."
          : "Gift Aid is enabled but charity registration type or number is missing."
        : "Gift Aid is off. This is fine if the tenant is not eligible or not registered.",
      tone: settings?.gift_aid_enabled
        ? hasGiftAidRegistration
          ? "good"
          : "warning"
        : "neutral",
      href: "/admin/donations",
      action: "View donations",
    },
    {
      title: "Payment and billing status",
      status: settings?.subscription_status || "Unknown",
      detail: settings?.stripe_connect_account_id
        ? "Stripe Connect account reference is present for this tenant."
        : "Stripe Connect account reference was not found in tenant settings. Confirm payment routing before live launch if tenant payouts are required.",
      tone: settings?.stripe_connect_account_id ? "good" : "warning",
      href: "/admin/settings/billing",
      action: "Open billing",
    },
    {
      title: "Campaign setup warnings",
      status:
        input.campaignWarnings.length === 0
          ? "No launch blockers detected"
          : `${input.campaignWarnings.length} warning${input.campaignWarnings.length === 1 ? "" : "s"}`,
      detail:
        input.campaignWarnings.length === 0
          ? "Published campaign checks did not detect missing prices, dates or key configuration issues."
          : "Review the campaign warnings before sharing widely.",
      tone: input.campaignWarnings.some((item) => item.tone === "danger")
        ? "danger"
        : input.campaignWarnings.length > 0
          ? "warning"
          : "good",
    },
    {
      title: "Receipts and live orders",
      status:
        paidDonationCount + paidEventOrderCount > 0
          ? "Live transactions detected"
          : "No paid transactions detected",
      detail:
        paidDonationCount + paidEventOrderCount > 0
          ? `${paidDonationCount} paid donation${paidDonationCount === 1 ? "" : "s"} and ${paidEventOrderCount} paid event order${paidEventOrderCount === 1 ? "" : "s"} detected.`
          : "Complete at least one controlled live/test purchase before launch confidence sign-off.",
      tone: paidDonationCount + paidEventOrderCount > 0 ? "good" : "warning",
      href: "/admin/orders",
      action: "Open orders",
    },
    {
      title: "Support channel",
      status: openSupportCount > 0 ? `${openSupportCount} open request${openSupportCount === 1 ? "" : "s"}` : "Ready",
      detail:
        openSupportCount > 0
          ? "There are open support requests to review before launch."
          : "Support request tracking is available for this tenant.",
      tone: openSupportCount > 0 ? "warning" : "good",
      href: "/admin/support",
      action: "Open support",
    },
  ];
}

export default async function AdminLaunchReadinessPage() {
  const tenantSlug = await requireTenantAccess();

  const [
    settings,
    raffles,
    squares,
    events,
    auctionsRaw,
    donationSummary,
    eventOrderSummary,
    supportSummary,
  ] = await Promise.all([
    getTenantLaunchSettings(tenantSlug),
    getRaffles(tenantSlug),
    getSquares(tenantSlug),
    getEvents(tenantSlug),
    listAuctions(tenantSlug),
    getPaidDonationSummary(tenantSlug),
    getPaidEventOrderSummary(tenantSlug),
    getSupportSummary(tenantSlug),
  ]);

  const auctions = (Array.isArray(auctionsRaw) ? auctionsRaw : []) as Array<
    Record<string, unknown>
  >;

  const raffleWarnings = buildRaffleWarnings(raffles);
  const squaresWarnings = buildSquaresWarnings(squares);
  const eventWarnings = buildEventWarnings(events);
  const auctionWarnings = buildAuctionWarnings(auctions);
  const campaignWarnings = [
    ...raffleWarnings,
    ...squaresWarnings,
    ...eventWarnings,
    ...auctionWarnings,
  ];

  const readinessItems = buildTenantReadinessItems({
    tenantSlug,
    settings,
    raffles,
    squares,
    events,
    auctions,
    donationSummary,
    eventOrderSummary,
    supportSummary,
    campaignWarnings,
  });

  const readinessScore = scoreReadiness(readinessItems);
  const overallTone = getOverallTone(readinessScore);
  const tier = normaliseSubscriptionTier(settings?.subscription_tier);
  const publishedCampaignCount =
    raffles.filter((item) => item.status === "published").length +
    squares.filter((item) => item.status === "published").length +
    events.filter((item) => item.status === "published").length +
    auctions.filter((item) => cleanText(item.status) === "published").length;

  const paidDonationTotal = Number(donationSummary?.total_cents || 0);
  const paidEventOrderTotal = Number(eventOrderSummary?.total_cents || 0);

  return (
    <main className="launch-readiness-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="launch-hero" style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>Phase 6F.1</div>

          <h1 className="launch-title" style={styles.title}>
            Launch Readiness
          </h1>

          <p style={styles.subtitle}>
            A read-only launch confidence check for this tenant. It highlights
            branding, public hub, campaigns, payments, Gift Aid, support and
            obvious campaign setup warnings without changing any live flow.
          </p>

          <p style={styles.tenantLine}>
            Tenant: <strong>{tenantSlug}</strong> · Plan:{" "}
            <strong>{getTierLabel(tier)}</strong>
          </p>
        </div>

        <div style={styles.scorePanel}>
          <span style={styles.scoreLabel}>Readiness score</span>
          <strong style={styles.scoreValue}>{readinessScore}%</strong>
          <span
            style={{
              ...styles.scorePill,
              ...readinessToneStyle(overallTone),
            }}
          >
            {readinessScore >= 85
              ? "Launch confident"
              : readinessScore >= 60
                ? "Nearly ready"
                : "Needs attention"}
          </span>
        </div>
      </section>

      <section className="top-actions" style={styles.topActions}>
        <Link href="/admin" style={styles.secondaryButton}>
          ← Back to dashboard
        </Link>

        <Link
          href={`/c/${tenantSlug}?adminReturn=${encodeURIComponent(
            "/admin/launch-readiness",
          )}`}
          target="_blank"
          style={styles.primaryButton}
        >
          View public hub
        </Link>

        <Link href="/admin/settings/branding" style={styles.secondaryButton}>
          Branding
        </Link>

        <Link href="/admin/settings/billing" style={styles.secondaryButton}>
          Billing
        </Link>
      </section>

      <section className="metric-grid" style={styles.metricGrid}>
        <MetricCard label="Published campaigns" value={publishedCampaignCount} />
        <MetricCard
          label="Paid donations"
          value={formatMoney(paidDonationTotal)}
        />
        <MetricCard
          label="Paid event orders"
          value={formatMoney(paidEventOrderTotal)}
        />
        <MetricCard
          label="Campaign warnings"
          value={campaignWarnings.length}
          tone={
            campaignWarnings.some((item) => item.tone === "danger")
              ? "danger"
              : campaignWarnings.length > 0
                ? "warning"
                : "good"
          }
        />
      </section>

      <section className="readiness-grid" style={styles.readinessGrid}>
        {readinessItems.map((item) => (
          <ReadinessCard key={item.title} item={item} />
        ))}
      </section>

      <section className="warning-section" style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionEyebrow}>Campaign checks</div>
            <h2 style={styles.sectionTitle}>Launch warnings</h2>
            <p style={styles.sectionText}>
              These checks look for obvious missing fields on published
              campaigns. They are advisory and do not block publishing.
            </p>
          </div>
        </div>

        {campaignWarnings.length === 0 ? (
          <div style={styles.emptyState}>
            No launch warnings detected for published campaigns.
          </div>
        ) : (
          <div style={styles.warningList}>
            {campaignWarnings.map((warning, index) => (
              <Link
                key={`${warning.title}-${index}`}
                href={warning.href}
                style={styles.warningLink}
              >
                <article
                  style={{
                    ...styles.warningCard,
                    ...readinessToneStyle(warning.tone),
                  }}
                >
                  <span style={styles.warningStatus}>
                    {statusLabel(warning.tone)}
                  </span>
                  <strong style={styles.warningTitle}>{warning.title}</strong>
                  <p style={styles.warningDetail}>{warning.detail}</p>
                  <span style={styles.warningAction}>Open campaign →</span>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="next-steps-grid" style={styles.nextStepsGrid}>
        <section style={styles.sectionCard}>
          <div style={styles.sectionEyebrow}>Launch sequence</div>
          <h2 style={styles.sectionTitle}>Recommended final checks</h2>

          <ol style={styles.stepList}>
            <li>Confirm branding and public contact email.</li>
            <li>Publish only campaigns that are ready to share.</li>
            <li>Open each public campaign page on mobile and desktop.</li>
            <li>Complete one controlled checkout or donation test.</li>
            <li>Confirm receipt email and admin order/reporting entry.</li>
            <li>Export CSV from the relevant orders/reporting page.</li>
          </ol>
        </section>

        <section style={styles.sectionCard}>
          <div style={styles.sectionEyebrow}>Important</div>
          <h2 style={styles.sectionTitle}>Read-only by design</h2>

          <p style={styles.sectionText}>
            This page does not write to the database and does not change
            checkout, Stripe, emails, raffles, squares, events, auctions,
            donations, Heads or Tails or Higher or Lower.
          </p>

          <div style={styles.infoBox}>
            Use it as a tenant launch checklist before inviting real organisers
            or supporters into the platform.
          </div>
        </section>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: ReadinessTone;
}) {
  return (
    <article style={styles.metricCard}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
      <span
        style={{
          ...styles.metricTone,
          ...readinessToneStyle(tone),
        }}
      >
        {statusLabel(tone)}
      </span>
    </article>
  );
}

function ReadinessCard({ item }: { item: ReadinessItem }) {
  return (
    <article style={styles.readinessCard}>
      <div style={styles.readinessTop}>
        <span
          style={{
            ...styles.statusPill,
            ...readinessToneStyle(item.tone),
          }}
        >
          {statusLabel(item.tone)}
        </span>
      </div>

      <h2 style={styles.cardTitle}>{item.title}</h2>
      <strong style={styles.cardStatus}>{item.status}</strong>
      <p style={styles.cardDetail}>{item.detail}</p>

      {item.href ? (
        <Link
          href={item.href}
          target={item.href.startsWith("/c/") ? "_blank" : undefined}
          style={styles.cardAction}
        >
          {item.action || "Open"}
        </Link>
      ) : null}
    </article>
  );
}

const responsiveStyles = `
.launch-readiness-page,
.launch-readiness-page * {
  box-sizing: border-box;
}

.launch-readiness-page {
  overflow-x: hidden;
}

.launch-readiness-page section,
.launch-readiness-page article,
.launch-readiness-page div,
.launch-readiness-page a,
.launch-readiness-page p,
.launch-readiness-page h1,
.launch-readiness-page h2,
.launch-readiness-page strong,
.launch-readiness-page span {
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 980px) {
  .launch-hero,
  .next-steps-grid {
    grid-template-columns: 1fr !important;
  }

  .top-actions,
  .metric-grid,
  .readiness-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 680px) {
  .launch-readiness-page {
    padding: 16px 10px 44px !important;
  }

  .launch-hero,
  .section-card {
    padding: 18px !important;
    border-radius: 24px !important;
  }

  .launch-title {
    font-size: clamp(38px, 13vw, 58px) !important;
    line-height: 0.98 !important;
  }

  .top-actions,
  .metric-grid,
  .readiness-grid {
    grid-template-columns: 1fr !important;
  }

  .top-actions a {
    width: 100% !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: "28px 16px 56px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 32%), radial-gradient(circle at top right, rgba(250,204,21,0.12), transparent 34%), #f8fafc",
    overflowX: "hidden",
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 0.28fr)",
    gap: 18,
    alignItems: "stretch",
    padding: 28,
    borderRadius: 32,
    background:
      "radial-gradient(circle at bottom right, rgba(250,204,21,0.18), transparent 38%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 28px 70px rgba(15,23,42,0.22)",
    border: "1px solid rgba(250,204,21,0.24)",
  },

  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 14px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.24)",
    color: "#facc15",
    border: "1px solid rgba(250,204,21,0.76)",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 14,
  },

  title: {
    margin: 0,
    fontSize: "clamp(52px, 7vw, 78px)",
    lineHeight: 0.94,
    letterSpacing: "-0.075em",
    color: "#ffffff",
    overflowWrap: "anywhere",
  },

  subtitle: {
    margin: "16px 0 0",
    maxWidth: 820,
    color: "#dbeafe",
    fontSize: 17,
    lineHeight: 1.6,
    fontWeight: 750,
  },

  tenantLine: {
    margin: "14px 0 0",
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  scorePanel: {
    display: "grid",
    alignContent: "center",
    justifyItems: "center",
    gap: 8,
    padding: 18,
    borderRadius: 24,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(250,204,21,0.28)",
    textAlign: "center",
  },

  scoreLabel: {
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  scoreValue: {
    color: "#ffffff",
    fontSize: 58,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.06em",
  },

  scorePill: {
    display: "inline-flex",
    justifyContent: "center",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
  },

  topActions: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, auto))",
    gap: 10,
    justifyContent: "start",
    marginBottom: 18,
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 15px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "1px solid #1683f8",
    textDecoration: "none",
    fontWeight: 950,
    textAlign: "center",
    boxShadow: "0 12px 22px rgba(22,131,248,0.2)",
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 15px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 900,
    textAlign: "center",
  },

  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 18,
  },

  metricCard: {
    display: "grid",
    gap: 8,
    padding: 16,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },

  metricLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  metricValue: {
    color: "#0f172a",
    fontSize: 30,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  metricTone: {
    display: "inline-flex",
    width: "fit-content",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
  },

  readinessGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
    marginBottom: 18,
  },

  readinessCard: {
    display: "grid",
    gap: 9,
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },

  readinessTop: {
    display: "flex",
    justifyContent: "flex-start",
  },

  statusPill: {
    display: "inline-flex",
    width: "fit-content",
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
  },

  cardTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.12,
    letterSpacing: "-0.04em",
  },

  cardStatus: {
    color: "#1e293b",
    fontSize: 15,
    fontWeight: 950,
  },

  cardDetail: {
    margin: 0,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 750,
  },

  cardAction: {
    display: "inline-flex",
    width: "fit-content",
    marginTop: 4,
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 950,
  },

  sectionCard: {
    display: "grid",
    gap: 14,
    padding: 22,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 18,
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  sectionEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 6,
  },

  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 28,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 750,
    maxWidth: 780,
  },

  emptyState: {
    padding: 18,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 850,
    textAlign: "center",
  },

  warningList: {
    display: "grid",
    gap: 10,
  },

  warningLink: {
    color: "inherit",
    textDecoration: "none",
    display: "block",
  },

  warningCard: {
    display: "grid",
    gap: 6,
    padding: 14,
    borderRadius: 18,
    border: "1px solid",
  },

  warningStatus: {
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  warningTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 950,
  },

  warningDetail: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 750,
  },

  warningAction: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: 950,
  },

  nextStepsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 18,
  },

  stepList: {
    margin: "8px 0 0",
    paddingLeft: 22,
    color: "#334155",
    lineHeight: 1.7,
    fontWeight: 750,
  },

  infoBox: {
    padding: 14,
    borderRadius: 18,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 850,
  },
};
