import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { getRaffleById } from "@/lib/raffles";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";
import { checkSubscriptionCapability } from "@/lib/subscription-capabilities";
import RaffleAdminActions from "./RaffleAdminActions";
import PrizeSettings from "./PrizeSettings";
import ImageFocusUploadField from "@/components/ImageFocusUploadField";
import DramaticRaffleDraw from "./DramaticRaffleDraw";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    payout?: string;
  }>;
};

type WinnerRow = {
  id: string;
  raffle_id: string;
  prize_position: number;
  prize_title: string | null;
  ticket_number: number;
  colour: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  raffle_subtype_snapshot: string | null;
  gross_paid_sales_cents: number | string | null;
  winner_prize_cents: number | string | null;
  cause_share_cents: number | string | null;
  paid_entry_count: number | string | null;
  postal_entry_count: number | string | null;
  total_entry_count: number | string | null;
  payout_status: string | null;
  payout_method: string | null;
  payout_date: string | null;
  payout_reference: string | null;
  payout_note: string | null;
  payout_recorded_by: string | null;
  payout_recorded_at: string | null;
};

type SoldTicketRow = {
  ticket_number: number;
  colour: string | null;
};

type ReadinessTone = "good" | "warning" | "neutral";

type ReadinessItem = {
  label: string;
  value: ReactNode;
  tone: ReadinessTone;
  detail: string;
};

const DEFAULT_RAFFLE_IMAGE = "/brand/so-default-raffles.png";

const PRESET_COLOURS = [
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Orange",
  "Purple",
  "Pink",
  "Black",
  "White",
];

const COLOUR_SWATCHES: Record<string, string> = {
  Red: "#ef4444",
  Blue: "#1683f8",
  Green: "#16a34a",
  Yellow: "#facc15",
  Orange: "#f97316",
  Purple: "#8b5cf6",
  Pink: "#ec4899",
  Black: "#111827",
  White: "#ffffff",
};

function colourToText(colour: any) {
  if (typeof colour === "string") return colour;
  if (colour?.name) return colour.name;
  if (colour?.hex) return colour.hex;
  return "";
}

function normaliseOfferForUI(offer: any, index: number) {
  const quantity = Number(offer?.quantity ?? offer?.tickets ?? 0);

  const price =
    offer?.price != null
      ? Number(offer.price)
      : offer?.price_cents != null
        ? Number(offer.price_cents) / 100
        : 0;

  return {
    id: offer?.id || `offer-${index + 1}`,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : "",
    price: Number.isFinite(price) && price > 0 ? price : "",
    is_active:
      offer?.is_active === false ||
      offer?.isActive === false ||
      offer?.active === false
        ? false
        : true,
  };
}

function normaliseImagePosition(value: unknown) {
  const clean = String(value ?? "").trim().toLowerCase();

  if (
    clean === "center" ||
    clean === "top" ||
    clean === "bottom" ||
    clean === "left" ||
    clean === "right"
  ) {
    return clean;
  }

  return "center";
}

function normaliseFocus(value: unknown, fallback = 50) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normaliseRaffleSubtype(value: unknown) {
  const clean = String(value ?? "").trim().toLowerCase();

  if (clean === "fifty_fifty") return "fifty_fifty";

  return "standard";
}

function getDateParts(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    day: String(date.getUTCDate()).padStart(2, "0"),
    month: String(date.getUTCMonth() + 1).padStart(2, "0"),
    year: String(date.getUTCFullYear()).padStart(4, "0"),
    hour: String(date.getUTCHours()).padStart(2, "0"),
    minute: String(date.getUTCMinutes()).padStart(2, "0"),
  };
}

function formatBritishDateInput(value: string | null | undefined) {
  const parts = getDateParts(value);

  if (!parts) return "";

  return `${parts.day}/${parts.month}/${parts.year}`;
}

function formatTimeInput(value: string | null | undefined) {
  const parts = getDateParts(value);

  if (!parts) return "";

  return `${parts.hour}:${parts.minute}`;
}

function formatDrawDate(value: string | null | undefined) {
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

function formatDateOnlyInput(value: string | null | undefined) {
  if (!value) return "";

  const clean = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  const date = new Date(clean);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function formatMoney(cents: number | string | null | undefined, currency: string) {
  const numericCents = Number(cents || 0);

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(Number(numericCents || 0) / 100);
  } catch {
    return `${(Number(numericCents || 0) / 100).toFixed(2)} ${
      currency || "GBP"
    }`;
  }
}

function formatWholeNumber(value: number | string | null | undefined) {
  const parsed = Number(value || 0);

  if (!Number.isFinite(parsed)) {
    return "0";
  }

  return String(Math.max(0, Math.round(parsed)));
}

function formatPayoutStatus(value: string | null | undefined) {
  const clean = String(value || "").trim().toLowerCase();

  if (clean === "paid") return "Paid";
  if (clean === "pending") return "Pending";
  if (clean === "not_required") return "Not required";

  return "Not recorded";
}

function getPayoutStatusStyle(value: string | null | undefined): CSSProperties {
  const clean = String(value || "").trim().toLowerCase();

  if (clean === "paid") {
    return {
      background: "#dcfce7",
      borderColor: "#bbf7d0",
      color: "#166534",
    };
  }

  if (clean === "pending") {
    return {
      background: "#fff7ed",
      borderColor: "#fed7aa",
      color: "#9a3412",
    };
  }

  return {
    background: "#f1f5f9",
    borderColor: "#e2e8f0",
    color: "#475569",
  };
}

function getStatusStyle(status: string): CSSProperties {
  const clean = status.toLowerCase();

  if (clean === "published") {
    return {
      background: "#dcfce7",
      borderColor: "#bbf7d0",
      color: "#166534",
    };
  }

  if (clean === "closed") {
    return {
      background: "#fff7ed",
      borderColor: "#fed7aa",
      color: "#9a3412",
    };
  }

  if (clean === "drawn") {
    return {
      background: "#dbeafe",
      borderColor: "#bfdbfe",
      color: "#1d4ed8",
    };
  }

  return {
    background: "#f1f5f9",
    borderColor: "#e2e8f0",
    color: "#475569",
  };
}

function readinessToneStyle(tone: ReadinessTone): CSSProperties {
  if (tone === "good") {
    return {
      background: "#ecfdf5",
      color: "#166534",
      borderColor: "#bbf7d0",
    };
  }

  if (tone === "warning") {
    return {
      background: "#fff7ed",
      color: "#9a3412",
      borderColor: "#fed7aa",
    };
  }

  return {
    background: "#f8fafc",
    color: "#475569",
    borderColor: "#e2e8f0",
  };
}

function getProgressPercent(sold: number, total: number) {
  if (!total || total <= 0) return 0;

  return Math.min(100, Math.max(0, Math.round((sold / total) * 100)));
}

function offerSavingText(
  quantity: number | "",
  price: number | "",
  singleTicketPriceCents: number,
) {
  if (!quantity || !price || !singleTicketPriceCents) {
    return "Bundle row";
  }

  const normalPrice = (Number(singleTicketPriceCents) / 100) * Number(quantity);
  const offerPrice = Number(price);
  const saving = normalPrice - offerPrice;

  if (!Number.isFinite(saving) || saving <= 0) {
    return "No saving";
  }

  return `Save ${saving.toFixed(2)}`;
}

function isConfigured(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

export default async function AdminRafflePage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const campaignLimitReached =
    resolvedSearchParams.error === "campaign_limit";

  const publicPreviewUnavailable =
    resolvedSearchParams.error === "public-preview-unavailable";

  const invalidDrawDateTime =
    resolvedSearchParams.error === "invalid_draw_datetime";

  const invalidPostalDateTime =
    resolvedSearchParams.error === "invalid_postal_datetime";

  const saveFailed = resolvedSearchParams.error === "save_failed";
  const payoutSaved = resolvedSearchParams.payout === "saved";
  const payoutSaveFailed = resolvedSearchParams.error === "payout_failed";

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

  const raffle = await getRaffleById(id);

  if (!raffle) {
    notFound();
  }

  if (raffle.tenant_slug !== tenantSlug) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  const config = (raffle.config_json as any) ?? {};
  const raffleSubtype = normaliseRaffleSubtype((raffle as any).raffle_subtype);
  const isFiftyFifty = raffleSubtype === "fifty_fifty";

  const imagePosition = normaliseImagePosition(config.image_position);
  const imageFocusX = normaliseFocus(config.image_focus_x, 50);
  const imageFocusY = normaliseFocus(config.image_focus_y, 50);

  const imageObjectPosition =
    config.image_focus_x != null || config.image_focus_y != null
      ? `${imageFocusX}% ${imageFocusY}%`
      : imagePosition;

  const autoDrawFromPrize = Number(config.auto_draw_from_prize || 1);
  const autoDrawToPrize = Number(config.auto_draw_to_prize || 999);

  const colours = Array.isArray(config.colours)
    ? config.colours.map(colourToText).filter(Boolean)
    : [];

  const offers = Array.isArray(config.offers)
    ? config.offers.map(normaliseOfferForUI)
    : [];

  const offerRows = [
    ...offers,
    ...Array.from({ length: Math.max(2, 5 - offers.length) }, (_, index) => ({
      id: `new-offer-${index + 1}`,
      quantity: "",
      price: "",
      is_active: true,
    })),
  ];

  const ticketPrice =
    Number(raffle.ticket_price_cents) > 0
      ? (Number(raffle.ticket_price_cents) / 100).toFixed(2)
      : "";
    const winners = await query<WinnerRow>(
    `
      select
        id,
        raffle_id,
        prize_position,
        prize_title,
        ticket_number,
        colour,
        buyer_name,
        buyer_email,
        raffle_subtype_snapshot,
        gross_paid_sales_cents,
        winner_prize_cents,
        cause_share_cents,
        paid_entry_count,
        postal_entry_count,
        total_entry_count,
        payout_status,
        payout_method,
        payout_date,
        payout_reference,
        payout_note,
        payout_recorded_by,
        payout_recorded_at
      from raffle_winners
      where raffle_id = $1
      order by prize_position asc
    `,
    [raffle.id],
  );

  const fiftyFiftySnapshotWinner =
    isFiftyFifty && winners.length > 0
      ? winners.find(
          (winner) =>
            normaliseRaffleSubtype(winner.raffle_subtype_snapshot) ===
            "fifty_fifty",
        ) || winners[0]
      : null;

  const soldTicketRows = await query<SoldTicketRow>(
    `
      select ticket_number, colour
      from raffle_ticket_sales
      where raffle_id = $1
      order by created_at asc
    `,
    [raffle.id],
  );

  const soldTicketsForDraw = soldTicketRows
    .map((ticket) => ({
      ticketNumber: Number(ticket.ticket_number),
      colour: ticket.colour,
    }))
    .filter((ticket) => Number.isFinite(ticket.ticketNumber));

  const soldTicketsCount = Number(raffle.sold_tickets || 0);
  const totalTickets = Number(raffle.total_tickets || 0);
  const remainingTickets = Math.max(totalTickets - soldTicketsCount, 0);
  const progress = getProgressPercent(soldTicketsCount, totalTickets);
  const statusStyle = getStatusStyle(raffle.status);
  const publicRaffleStatus = String(raffle.status || "").trim().toLowerCase();
  const canViewPublicRaffle = publicRaffleStatus === "published";

  const soldByColour = soldTicketRows.reduce((acc, ticket) => {
    const key = ticket.colour || "No colour";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const legalQuestionTextConfigured = isConfigured(config.question?.text);
  const legalQuestionAnswerConfigured = isConfigured(config.question?.answer);
  const legalQuestionEnabled =
    legalQuestionTextConfigured && legalQuestionAnswerConfigured;
  const legalQuestionPartiallyConfigured =
    legalQuestionTextConfigured !== legalQuestionAnswerConfigured;

  const postalEntryAddressConfigured = isConfigured(config.free_entry?.address);
  const postalEntryInstructionsConfigured = isConfigured(
    config.free_entry?.instructions,
  );
  const postalEntryClosingConfigured = isConfigured(config.free_entry?.closes_at);
  const postalEntryEnabled =
    postalEntryAddressConfigured && postalEntryInstructionsConfigured;
  const postalEntryPartiallyConfigured =
    postalEntryAddressConfigured !== postalEntryInstructionsConfigured;

  const prizesConfigured =
    Array.isArray(config.prizes) && config.prizes.length > 0;

  const ticketPriceConfigured = Number(raffle.ticket_price_cents || 0) > 0;
  const ticketRangeConfigured = totalTickets > 0;
  const drawDateConfigured = isConfigured(raffle.draw_at);
  const publishedNeedsAttention =
    canViewPublicRaffle &&
    (!ticketPriceConfigured ||
      !ticketRangeConfigured ||
      !drawDateConfigured ||
      !legalQuestionEnabled ||
      !postalEntryEnabled ||
      (!isFiftyFifty && !prizesConfigured));

  const readinessItems: ReadinessItem[] = [
    {
      label: "Public page",
      value: canViewPublicRaffle
        ? "Published"
        : String(raffle.status || "Draft"),
      tone: canViewPublicRaffle ? "good" : "warning",
      detail: canViewPublicRaffle
        ? publishedNeedsAttention
          ? "This raffle is public, but one or more launch checks need attention."
          : "Supporters can open the public raffle page."
        : "Draft, closed and drawn raffles are not open for public entries.",
    },
    {
      label: "Tickets",
      value:
        ticketRangeConfigured && ticketPriceConfigured
          ? `${totalTickets} tickets`
          : "Needs setup",
      tone: ticketRangeConfigured && ticketPriceConfigured ? "good" : "warning",
      detail:
        ticketRangeConfigured && ticketPriceConfigured
          ? `${remainingTickets} tickets remain available.`
          : !ticketPriceConfigured && !ticketRangeConfigured
            ? "Set a ticket price and ticket range before selling entries."
            : !ticketPriceConfigured
              ? "Set a valid ticket price before selling entries."
              : "Set a valid ticket range before selling entries.",
    },
    {
      label: "Draw",
      value: formatDrawDate(raffle.draw_at),
      tone: drawDateConfigured ? "good" : "warning",
      detail: drawDateConfigured
        ? "Draw date is set for the raffle."
        : canViewPublicRaffle
          ? "This raffle is published without a draw date. Add one before sharing widely."
          : "Add a draw date before publishing or promoting the raffle.",
    },
    {
      label: "Legal question",
      value: legalQuestionEnabled
        ? "Configured"
        : legalQuestionPartiallyConfigured
          ? "Incomplete"
          : "Missing",
      tone: legalQuestionEnabled ? "good" : "warning",
      detail: legalQuestionEnabled
        ? "Public entrants must answer the skill question before checkout."
        : legalQuestionPartiallyConfigured
          ? "Complete both the entry question and correct answer before launch."
          : "Add the entry question and correct answer for compliance.",
    },
    {
      label: "Postal entry",
      value: postalEntryEnabled
        ? postalEntryClosingConfigured
          ? "Configured"
          : "Closing date missing"
        : postalEntryPartiallyConfigured
          ? "Incomplete"
          : "Missing",
      tone:
        postalEntryEnabled && postalEntryClosingConfigured ? "good" : "warning",
      detail:
        postalEntryEnabled && postalEntryClosingConfigured
          ? "Free postal entry details and closing date are available."
          : postalEntryEnabled
            ? "Free postal entry address and instructions are present. Add a postal closing date if required before launch."
            : postalEntryPartiallyConfigured
              ? "Complete both the free postal entry address and instructions."
              : "Add the free postal entry address and instructions.",
    },
    {
      label: isFiftyFifty ? "Prize pot" : "Prizes",
      value: isFiftyFifty
        ? "50/50 mode"
        : prizesConfigured
          ? `${config.prizes.length} prizes`
          : "No prizes",
      tone: isFiftyFifty || prizesConfigured ? "good" : "warning",
      detail: isFiftyFifty
        ? "Winner and cause shares are calculated from paid ticket sales."
        : prizesConfigured
          ? "Prize rows are configured for the draw."
          : canViewPublicRaffle
            ? "This raffle is published without prize rows. Add prizes before promoting it."
            : "Add prize rows before promoting the raffle.",
    },
  ];

  const readinessReady =
    canViewPublicRaffle &&
    ticketRangeConfigured &&
    ticketPriceConfigured &&
    drawDateConfigured &&
    legalQuestionEnabled &&
    postalEntryEnabled &&
    (isFiftyFifty || prizesConfigured);

  return (
    <main className="raffle-admin-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="raffle-topbar" style={styles.topBar}>
        <Link href="/admin/raffles" style={styles.backLink}>
          ← Back to raffles
        </Link>

        <Link
          href={
            canViewPublicRaffle
              ? `/r/${raffle.slug}?adminReturn=/admin/raffles/${raffle.id}`
              : `/admin/raffles/${raffle.id}?error=public-preview-unavailable`
          }
          target={canViewPublicRaffle ? "_blank" : undefined}
          style={styles.publicLink}
        >
          View campaign page
        </Link>
      </section>

      {campaignLimitReached ? (
        <section style={styles.campaignLimitBanner}>
          <div style={styles.campaignLimitEyebrow}>Plan limit reached</div>

          <h2 style={styles.campaignLimitTitle}>
            This raffle was not published.
          </h2>

          <p style={styles.campaignLimitText}>
            This tenant has reached its active campaign allowance across
            raffles, squares and events. Your raffle changes were not published.
            Close or unpublish another campaign, save this raffle as a draft, or
            upgrade the tenant plan from the owner billing page.
          </p>

          <div style={styles.campaignLimitActions}>
            <Link href="/admin/raffles" style={styles.campaignLimitSecondary}>
              Manage raffles
            </Link>

            <Link
              href="/admin/settings/billing"
              style={styles.campaignLimitPrimary}
            >
              View billing
            </Link>
          </div>
        </section>
      ) : null}

      {publicPreviewUnavailable ? (
        <section style={styles.campaignLimitBanner}>
          <div style={styles.campaignLimitEyebrow}>Preview unavailable</div>

          <h2 style={styles.campaignLimitTitle}>
            This raffle is not public yet.
          </h2>

          <p style={styles.campaignLimitText}>
            Draft raffles are hidden from public campaign pages. Publish this
            raffle when you are ready for supporters to view and enter it.
          </p>
        </section>
      ) : null}

      {invalidDrawDateTime ||
      invalidPostalDateTime ||
      saveFailed ||
      payoutSaveFailed ? (
        <section style={styles.validationBanner}>
          <div style={styles.validationEyebrow}>
            {saveFailed || payoutSaveFailed ? "Save issue" : "Date format issue"}
          </div>

          <h2 style={styles.validationTitle}>
            {invalidDrawDateTime
              ? "Please check the draw date."
              : invalidPostalDateTime
                ? "Please check the postal closing date."
                : payoutSaveFailed
                  ? "The payout tracker could not be saved."
                  : "The raffle could not be saved."}
          </h2>

          <p style={styles.validationText}>
            {invalidDrawDateTime
              ? "Draw date must use DD/MM/YYYY format, for example 31/10/2026. Draw time must use 24-hour HH:MM format, for example 19:00. You can also leave both fields blank while drafting."
              : invalidPostalDateTime
                ? "Postal closing date must use DD/MM/YYYY format, for example 31/10/2026. Postal closing time must use 24-hour HH:MM format, for example 18:00. You can also leave both fields blank."
                : payoutSaveFailed
                  ? "Please check the payout status, method, date, reference and note, then try again. No Stripe payout has been triggered."
                  : "Please check the form values and try again. The raffle has not been changed."}
          </p>
        </section>
      ) : null}

      {payoutSaved ? (
        <section style={styles.successBanner}>
          <div style={styles.successEyebrow}>Payout tracker saved</div>

          <p style={styles.successText}>
            The 50/50 payout tracking details have been updated for this winner.
          </p>
        </section>
      ) : null}

      <section className="raffle-hero" style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>
            {isFiftyFifty ? "50/50 raffle editor" : "Raffle editor"}
          </div>

          <div style={styles.heroTitleRow}>
            <h1 className="so-brand-heading" style={styles.heroTitle}>
              {raffle.title}
            </h1>

            <span style={{ ...styles.statusPill, ...statusStyle }}>
              {raffle.status}
            </span>
          </div>

          <p style={styles.heroSlug}>/r/{raffle.slug}</p>

          {raffle.description ? (
            <p style={styles.heroDescription}>{raffle.description}</p>
          ) : (
            <p style={styles.heroDescriptionMuted}>
              No description added yet.
            </p>
          )}

          <div className="raffle-hero-meta" style={styles.heroMetaGrid}>
            <HeroMeta label="Draw" value={formatDrawDate(raffle.draw_at)} />

            <HeroMeta
              label="Tickets sold"
              value={`${soldTicketsCount}/${totalTickets}`}
            />

            <HeroMeta label="Progress" value={`${progress}% sold`} />
          </div>
        </div>

        <div className="raffle-hero-image" style={styles.heroImageWrap}>
          <img
            src={raffle.image_url || DEFAULT_RAFFLE_IMAGE}
            alt={raffle.title || "SO Raffles"}
            style={{
              ...styles.heroImage,
              objectFit: raffle.image_url ? "cover" : "contain",
              objectPosition: raffle.image_url
                ? imageObjectPosition
                : "center",
              padding: raffle.image_url ? 0 : 28,
              background: raffle.image_url
                ? "#1e293b"
                : "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
              boxSizing: "border-box",
            }}
          />
        </div>
      </section>
            <section className="raffle-readiness-panel" style={styles.readinessPanel}>
        <div style={styles.readinessHeader}>
          <div>
            <div style={styles.readinessEyebrow}>Campaign readiness</div>

            <h2 style={styles.readinessTitle}>Raffle readiness snapshot</h2>

            <p style={styles.readinessIntro}>
              A quick operational check before sharing the raffle, taking paid
              entries or running the draw. Published raffles with incomplete
              legal, postal, pricing or prize setup are highlighted here.
            </p>
          </div>

          <span
            style={{
              ...styles.readinessStatusPill,
              ...readinessToneStyle(readinessReady ? "good" : "warning"),
            }}
          >
            {readinessReady ? "Ready to sell" : "Needs attention"}
          </span>
        </div>

        <div className="raffle-readiness-grid" style={styles.readinessGrid}>
          {readinessItems.map((item) => (
            <div
              key={item.label}
              className="raffle-readiness-item"
              style={styles.readinessItem}
            >
              <div
                style={{
                  ...styles.readinessToneDot,
                  ...readinessToneStyle(item.tone),
                }}
              />

              <div style={styles.readinessContent}>
                <span style={styles.readinessLabel}>{item.label}</span>

                <strong
                  className="raffle-readiness-value"
                  style={styles.readinessValue}
                >
                  {item.value}
                </strong>

                <span
                  className="raffle-readiness-detail"
                  style={styles.readinessDetail}
                >
                  {item.detail}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="raffle-summary-grid" style={styles.summaryGrid}>
        <SummaryCard
          label="Raffle type"
          value={isFiftyFifty ? "50/50" : "Standard"}
        />

        <SummaryCard
          label="Ticket price"
          value={formatMoney(raffle.ticket_price_cents, raffle.currency)}
        />

        <SummaryCard
          label="Draw date"
          value={formatDrawDate(raffle.draw_at)}
        />

        <SummaryCard label="Total tickets" value={totalTickets} />

        <SummaryCard label="Sold" value={soldTicketsCount} />

        <SummaryCard label="Remaining" value={remainingTickets} />
      </section>

      {isFiftyFifty ? (
        <section style={styles.fiftyFiftyNotice}>
          <div style={styles.fiftyFiftyNoticeEyebrow}>50/50 raffle mode</div>

          <h2 style={styles.fiftyFiftyNoticeTitle}>
            This raffle uses the existing legal and checkout structure.
          </h2>

          <p style={styles.fiftyFiftyNoticeText}>
            The entry question, free postal entry route, terms acceptance,
            ticket reservation and Stripe checkout flow remain in place. Bundle
            offers and fixed prize setup are disabled for 50/50 raffles in this
            first release.
          </p>

          <div className="raffle-fifty-stats" style={styles.fiftyFiftyStats}>
            <div style={styles.fiftyFiftyStat}>
              <span>Winner share</span>
              <strong>50%</strong>
            </div>

            <div style={styles.fiftyFiftyStat}>
              <span>Cause share</span>
              <strong>50%</strong>
            </div>

            <div style={styles.fiftyFiftyStat}>
              <span>Payout</span>
              <strong>
                {fiftyFiftySnapshotWinner
                  ? formatPayoutStatus(fiftyFiftySnapshotWinner.payout_status)
                  : "After draw"}
              </strong>
            </div>
          </div>
        </section>
      ) : null}

      {isFiftyFifty && fiftyFiftySnapshotWinner ? (
        <section style={styles.fiftyFiftySnapshotCard}>
          <div style={styles.fiftyFiftySnapshotHeader}>
            <div>
              <div style={styles.fiftyFiftySnapshotEyebrow}>
                50/50 payout snapshot
              </div>

              <h2 style={styles.fiftyFiftySnapshotTitle}>
                Winner prize and cause share
              </h2>

              <p style={styles.fiftyFiftySnapshotText}>
                This snapshot was recorded when the winner was drawn. The payout
                tracker below is manual admin tracking only and does not trigger
                any Stripe payout.
              </p>
            </div>

            <span
              style={{
                ...styles.payoutStatusPill,
                ...getPayoutStatusStyle(fiftyFiftySnapshotWinner.payout_status),
              }}
            >
              {formatPayoutStatus(fiftyFiftySnapshotWinner.payout_status)}
            </span>
          </div>

          <div
            className="raffle-fifty-snapshot-grid"
            style={styles.fiftyFiftySnapshotGrid}
          >
            <SnapshotStat
              label="Gross paid ticket sales"
              value={formatMoney(
                fiftyFiftySnapshotWinner.gross_paid_sales_cents,
                raffle.currency,
              )}
              emphasis
            />

            <SnapshotStat
              label="Winner prize"
              value={formatMoney(
                fiftyFiftySnapshotWinner.winner_prize_cents,
                raffle.currency,
              )}
              emphasis
            />

            <SnapshotStat
              label="Cause share"
              value={formatMoney(
                fiftyFiftySnapshotWinner.cause_share_cents,
                raffle.currency,
              )}
              emphasis
            />

            <SnapshotStat
              label="Paid entries"
              value={formatWholeNumber(
                fiftyFiftySnapshotWinner.paid_entry_count,
              )}
            />

            <SnapshotStat
              label="Postal/manual entries"
              value={formatWholeNumber(
                fiftyFiftySnapshotWinner.postal_entry_count,
              )}
            />

            <SnapshotStat
              label="Total entries"
              value={formatWholeNumber(
                fiftyFiftySnapshotWinner.total_entry_count,
              )}
            />
          </div>

          <form
            action={`/api/admin/raffles/${raffle.id}/payout`}
            method="post"
            style={styles.payoutForm}
          >
            <div style={styles.payoutFormHeader}>
              <div>
                <h3 style={styles.payoutFormTitle}>Manual payout tracker</h3>

                <p style={styles.payoutFormText}>
                  Record how the 50/50 winner was paid. This is admin tracking
                  only.
                </p>
              </div>
            </div>

            <div className="raffle-payout-grid" style={styles.payoutGrid}>
              <Field label="Payout status">
                <select
                  name="payout_status"
                  defaultValue={
                    fiftyFiftySnapshotWinner.payout_status || "pending"
                  }
                  style={styles.input}
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="not_required">Not required</option>
                </select>
              </Field>

              <Field label="Payout method">
                <input
                  name="payout_method"
                  defaultValue={fiftyFiftySnapshotWinner.payout_method || ""}
                  placeholder="Bank transfer, cash, cheque..."
                  style={styles.input}
                />
              </Field>

              <Field label="Payout date">
                <input
                  name="payout_date"
                  type="date"
                  defaultValue={formatDateOnlyInput(
                    fiftyFiftySnapshotWinner.payout_date,
                  )}
                  style={styles.input}
                />
              </Field>

              <Field label="Reference">
                <input
                  name="payout_reference"
                  defaultValue={fiftyFiftySnapshotWinner.payout_reference || ""}
                  placeholder="Transfer reference or internal ref"
                  style={styles.input}
                />
              </Field>
            </div>

            <Field label="Internal note">
              <textarea
                name="payout_note"
                rows={3}
                defaultValue={fiftyFiftySnapshotWinner.payout_note || ""}
                placeholder="Optional internal payout note"
                style={styles.textarea}
              />
            </Field>

            <div style={styles.payoutMetaRow}>
              <div style={styles.payoutMetaText}>
                Last recorded by{" "}
                <strong>
                  {fiftyFiftySnapshotWinner.payout_recorded_by ||
                    "not recorded"}
                </strong>
                {fiftyFiftySnapshotWinner.payout_recorded_at
                  ? ` · ${formatDrawDate(
                      fiftyFiftySnapshotWinner.payout_recorded_at,
                    )}`
                  : ""}
              </div>

              <button type="submit" style={styles.payoutSubmitButton}>
                Save payout tracker
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section style={styles.progressCard}>
        <div style={styles.progressHeader}>
          <div>
            <strong style={{ color: "#0f172a" }}>Sales progress</strong>

            <div style={styles.mutedSmall}>
              {soldTicketsCount} sold from {totalTickets} tickets
            </div>
          </div>

          <div style={styles.progressPercent}>{progress}%</div>
        </div>

        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${progress}%`,
            }}
          />
        </div>
      </section>

      <section style={styles.actionsCard}>
        <div>
          <h2 style={styles.sectionTitle}>Raffle actions</h2>

          <p style={styles.sectionDescription}>
            Publish, close, draw or remove this raffle using the existing action
            controls.
          </p>
        </div>

        <RaffleAdminActions raffleId={raffle.id} status={raffle.status} />
      </section>

      <section style={styles.section}>
        <details open style={styles.adminDetails}>
          <summary
            className="raffle-admin-summary"
            style={styles.adminSummary}
          >
            <div>
              <div style={styles.sectionEyebrow}>Section 1</div>

              <h2 style={styles.sectionTitle}>Edit raffle</h2>

              <p style={styles.sectionDescription}>
                Update the public details, pricing, legal settings, colours and
                offer bundles.
              </p>
            </div>

            <div
              className="raffle-summary-pills"
              style={styles.summaryPillRow}
            >
              <StatusMiniPill label="Legal" active={legalQuestionEnabled} />

              <StatusMiniPill label="Postal" active={postalEntryEnabled} />

              {isFiftyFifty ? (
                <span style={styles.fiftyFiftyMiniPill}>50/50</span>
              ) : null}

              <span style={styles.adminSummaryToggle}>Open / close</span>
            </div>
          </summary>

          <div style={styles.adminDetailsBody}>
            <form
              action={`/api/admin/raffles/${raffle.id}`}
              method="post"
              style={styles.form}
            >
              <input
                type="hidden"
                name="image_position"
                value={imagePosition}
              />

              <section style={styles.innerPanel}>
                <div style={styles.innerHeader}>
                  <div>
                    <div style={styles.innerEyebrow}>Public overview</div>

                    <h3 style={styles.subTitle}>Campaign details</h3>

                    <p style={styles.sectionDescription}>
                      These details are shown on the public raffle page.
                    </p>
                  </div>
                </div>

                <div className="raffle-two-column" style={styles.twoColumn}>
                  <Field label="Title">
                    <input
                      name="title"
                      defaultValue={raffle.title}
                      required
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Slug">
                    <input
                      name="slug"
                      defaultValue={raffle.slug}
                      required
                      style={styles.input}
                    />
                  </Field>
                </div>

                <Field label="Description">
                  <textarea
                    name="description"
                    rows={4}
                    defaultValue={raffle.description ?? ""}
                    style={styles.textarea}
                  />
                </Field>
                                <div className="raffle-media-box" style={styles.mediaBox}>
                  <div style={styles.mediaControls}>
                    <h3 style={styles.subTitle}>Raffle image</h3>

                    <p style={styles.sectionDescription}>
                      Upload or replace the public image, then choose the crop
                      focus. If no image is uploaded, the SO default raffle image
                      is shown.
                    </p>

                    <ImageFocusUploadField
                      currentImageUrl={raffle.image_url ?? ""}
                      currentFocusX={imageFocusX}
                      currentFocusY={imageFocusY}
                      label="Raffle image"
                      previewAlt={raffle.title}
                      subscriptionTier={tenantSettings?.subscription_tier}
                      customImagesAllowed={customImagesCapability.allowed}
                    />
                  </div>

                  <div className="raffle-preview-box" style={styles.previewBox}>
                    <img
                      src={raffle.image_url || DEFAULT_RAFFLE_IMAGE}
                      alt={raffle.title || "SO Raffles"}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: raffle.image_url ? "cover" : "contain",
                        objectPosition: raffle.image_url
                          ? imageObjectPosition
                          : "center",
                        display: "block",
                        padding: raffle.image_url ? 0 : 22,
                        boxSizing: "border-box",
                        background: raffle.image_url
                          ? "#ffffff"
                          : "linear-gradient(135deg, #ffffff 0%, #f8fafc 52%, #eff6ff 100%)",
                      }}
                    />
                  </div>
                </div>

                <div
                  className="raffle-subtype-grid"
                  style={styles.subtypeGrid}
                >
                  <label
                    style={{
                      ...styles.subtypeCard,
                      borderColor: !isFiftyFifty ? "#1683f8" : "#e2e8f0",
                      background: !isFiftyFifty ? "#eff6ff" : "#ffffff",
                    }}
                  >
                    <input
                      type="radio"
                      name="raffle_subtype"
                      value="standard"
                      defaultChecked={!isFiftyFifty}
                    />

                    <span style={styles.subtypeTitle}>Standard raffle</span>

                    <span style={styles.subtypeText}>
                      Fixed prize setup, optional bundle offers and the existing
                      raffle draw flow.
                    </span>
                  </label>

                  <label
                    style={{
                      ...styles.subtypeCard,
                      borderColor: isFiftyFifty ? "#d97706" : "#e2e8f0",
                      background: isFiftyFifty ? "#fffbeb" : "#ffffff",
                    }}
                  >
                    <input
                      type="radio"
                      name="raffle_subtype"
                      value="fifty_fifty"
                      defaultChecked={isFiftyFifty}
                    />

                    <span style={styles.subtypeTitle}>50/50 raffle</span>

                    <span style={styles.subtypeText}>
                      Half the paid ticket pot goes to the winner and half
                      supports the cause.
                    </span>
                  </label>
                </div>

                {isFiftyFifty ? (
                  <div style={styles.fiftyFiftyInlineNotice}>
                    <strong>50/50 mode is active.</strong>
                    <span>
                      Bundle offers and fixed prize setup are disabled for this
                      raffle type. The legal question, postal entry details and
                      checkout flow remain active.
                    </span>
                  </div>
                ) : null}

                <div className="raffle-three-column" style={styles.threeColumn}>
                  <Field label="Draw date">
                    <input
                      name="draw_date"
                      type="text"
                      inputMode="numeric"
                      defaultValue={formatBritishDateInput(raffle.draw_at)}
                      placeholder="DD/MM/YYYY"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Draw time">
                    <input
                      name="draw_time"
                      type="text"
                      inputMode="numeric"
                      defaultValue={formatTimeInput(raffle.draw_at)}
                      placeholder="HH:MM"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Status">
                    <select
                      name="status"
                      defaultValue={raffle.status}
                      style={styles.input}
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="closed">Closed</option>
                      <option value="drawn">Drawn</option>
                    </select>
                  </Field>

                  <Field label="Currency">
                    <select
                      name="currency"
                      defaultValue={raffle.currency ?? "GBP"}
                      style={styles.input}
                    >
                      <option value="GBP">GBP</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                    </select>
                  </Field>
                </div>
              </section>

              <section style={styles.innerPanel}>
                <div style={styles.innerHeader}>
                  <div>
                    <div style={styles.innerEyebrow}>Ticket setup</div>

                    <h3 style={styles.subTitle}>Pricing & bundles</h3>

                    <p style={styles.sectionDescription}>
                      {isFiftyFifty
                        ? "Configure the ticket price, number range and colours. Bundle offers are disabled for 50/50 raffles."
                        : "Configure pricing, number range, colours and bundle offers."}
                    </p>
                  </div>
                </div>

                <div className="raffle-three-column" style={styles.threeColumn}>
                  <Field label="Ticket price">
                    <input
                      name="ticket_price"
                      type="number"
                      step="0.01"
                      min={0}
                      defaultValue={ticketPrice}
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Start number">
                    <input
                      name="startNumber"
                      type="number"
                      defaultValue={config.startNumber ?? 1}
                      style={styles.input}
                    />
                  </Field>

                  <Field label="End number">
                    <input
                      name="endNumber"
                      type="number"
                      defaultValue={config.endNumber ?? raffle.total_tickets}
                      style={styles.input}
                    />
                  </Field>
                </div>

                <div className="raffle-colour-grid" style={styles.colourGrid}>
                  {PRESET_COLOURS.map((colour) => {
                    const selected = colours.includes(colour);
                    const swatch = COLOUR_SWATCHES[colour] || "#e2e8f0";

                    return (
                      <label
                        key={colour}
                        style={{
                          ...styles.colourCard,
                          borderColor: selected ? "#1683f8" : "#e2e8f0",
                          background: selected ? "#eff6ff" : "#ffffff",
                        }}
                      >
                        <input
                          type="checkbox"
                          name="colour_preset"
                          value={colour}
                          defaultChecked={selected}
                        />

                        <span
                          style={{
                            ...styles.swatch,
                            background: swatch,
                            borderColor:
                              colour === "White" ? "#cbd5e1" : "transparent",
                          }}
                        />

                        <span style={styles.colourText}>
                          <strong>{colour}</strong>
                          <small>{soldByColour[colour] || 0} sold</small>
                        </span>
                      </label>
                    );
                  })}
                </div>

                <Field label="Custom colours">
                  <input
                    name="custom_colours"
                    placeholder="Gold, Silver, #00ff00"
                    defaultValue={colours
                      .filter(
                        (colour: string) => !PRESET_COLOURS.includes(colour),
                      )
                      .join(", ")}
                    style={styles.input}
                  />
                </Field>

                {isFiftyFifty ? (
                  <div style={styles.disabledPanel}>
                    <div style={styles.disabledEyebrow}>Disabled for 50/50</div>

                    <h3 style={styles.subTitle}>Bundle offers</h3>

                    <p style={styles.sectionDescription}>
                      Bundle offers are disabled for 50/50 raffles in this first
                      release so the prize pot remains simple and transparent.
                      Saving this raffle in 50/50 mode clears active offer rows.
                    </p>
                  </div>
                ) : (
                  <>
                    <input
                      type="hidden"
                      name="offer_count"
                      value={offerRows.length}
                    />

                    <div style={styles.offerList}>
                      {offerRows.map((offer, index) => (
                        <div
                          key={`${offer.id}-${index}`}
                          style={styles.offerCard}
                        >
                          <div style={styles.offerBadge}>
                            {offerSavingText(
                              offer.quantity as number | "",
                              offer.price as number | "",
                              raffle.ticket_price_cents,
                            )}
                          </div>

                          <div
                            className="raffle-offer-inputs"
                            style={styles.offerInputs}
                          >
                            <Field label="Number of tickets">
                              <input
                                name={`offer_quantity_${index}`}
                                type="number"
                                min={1}
                                defaultValue={offer.quantity}
                                placeholder="3"
                                style={styles.input}
                              />
                            </Field>

                            <Field label="Total offer price">
                              <input
                                name={`offer_price_${index}`}
                                type="number"
                                min={0}
                                step="0.01"
                                defaultValue={offer.price}
                                placeholder="12.00"
                                style={styles.input}
                              />
                            </Field>

                            <label style={styles.checkboxLabel}>
                              <input
                                name={`offer_active_${index}`}
                                type="checkbox"
                                value="true"
                                defaultChecked={offer.is_active}
                              />
                              Use
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              <section style={styles.innerPanel}>
                <div style={styles.innerHeader}>
                  <div>
                    <div style={styles.innerEyebrow}>Compliance</div>

                    <h3 style={styles.subTitle}>Legal & postal entry</h3>

                    <p style={styles.sectionDescription}>
                      Add a skill-based entry question and the free postal entry
                      route shown on the public raffle page.
                      {isFiftyFifty
                        ? " 50/50 raffles use the same legal framework."
                        : ""}
                    </p>
                  </div>
                </div>

                <div className="raffle-two-column" style={styles.twoColumn}>
                  <Field label="Entry question">
                    <input
                      name="question_text"
                      defaultValue={String(config.question?.text ?? "")}
                      placeholder="e.g. What colour is a London taxi?"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Correct answer">
                    <input
                      name="question_answer"
                      defaultValue={String(config.question?.answer ?? "")}
                      placeholder="e.g. black"
                      style={styles.input}
                    />
                  </Field>
                </div>

                <Field label="Postal address">
                  <textarea
                    name="free_entry_address"
                    rows={3}
                    defaultValue={String(config.free_entry?.address ?? "")}
                    placeholder="e.g. SO Foundation, 123 High Street, London"
                    style={styles.textarea}
                  />
                </Field>

                <Field label="Postal instructions">
                  <textarea
                    name="free_entry_instructions"
                    rows={4}
                    defaultValue={String(config.free_entry?.instructions ?? "")}
                    placeholder="Include your full name, email address and answer to the question."
                    style={styles.textarea}
                  />
                </Field>

                <div className="raffle-two-column" style={styles.twoColumn}>
                  <Field label="Postal entry closing date">
                    <input
                      name="free_entry_closes_date"
                      type="text"
                      inputMode="numeric"
                      defaultValue={formatBritishDateInput(
                        config.free_entry?.closes_at,
                      )}
                      placeholder="DD/MM/YYYY"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Postal entry closing time">
                    <input
                      name="free_entry_closes_time"
                      type="text"
                      inputMode="numeric"
                      defaultValue={formatTimeInput(
                        config.free_entry?.closes_at,
                      )}
                      placeholder="HH:MM"
                      style={styles.input}
                    />
                  </Field>
                </div>

                <p style={styles.helpText}>
                  Postal entries must include an email address so the entrant can
                  be contacted if they win.
                </p>
              </section>
                            <section style={styles.innerPanel}>
                <div style={styles.innerHeader}>
                  <div>
                    <div style={styles.innerEyebrow}>Draw system</div>

                    <h3 style={styles.subTitle}>Draw settings</h3>

                    <p style={styles.sectionDescription}>
                      Choose which prize numbers the automatic randomizer should
                      draw.
                    </p>
                  </div>
                </div>

                <div className="raffle-two-column" style={styles.twoColumn}>
                  <Field label="Auto draw from prize number">
                    <input
                      name="auto_draw_from_prize"
                      type="number"
                      min={1}
                      defaultValue={autoDrawFromPrize}
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Auto draw to prize number">
                    <input
                      name="auto_draw_to_prize"
                      type="number"
                      min={1}
                      defaultValue={autoDrawToPrize}
                      style={styles.input}
                    />
                  </Field>
                </div>
              </section>

              <section style={styles.submitBar}>
                <div>
                  <strong style={{ color: "#0f172a" }}>Save changes</strong>

                  <div style={styles.mutedSmall}>
                    This updates the raffle page and admin values.
                  </div>
                </div>

                <button type="submit" style={styles.submitButton}>
                  Save raffle
                </button>
              </section>
            </form>
          </div>
        </details>
      </section>

      <section style={styles.section}>
        <details
          open={!prizesConfigured && !isFiftyFifty}
          style={styles.adminDetails}
        >
          <summary className="raffle-admin-summary" style={styles.adminSummary}>
            <div>
              <div style={styles.sectionEyebrow}>Section 2</div>

              <h2 style={styles.sectionTitle}>
                {isFiftyFifty ? "50/50 prize pot" : "Prize management"}
              </h2>

              <p style={styles.sectionDescription}>
                {isFiftyFifty
                  ? "The winner prize is calculated from paid ticket sales."
                  : "Manage prize names, descriptions and public visibility."}
              </p>
            </div>

            <span style={styles.adminSummaryToggle}>Open / close</span>
          </summary>

          <div style={styles.adminDetailsBody}>
            {isFiftyFifty ? (
              <div style={styles.fiftyFiftyPrizePanel}>
                <div style={styles.fiftyFiftyPrizeStat}>
                  <span>Winner share</span>
                  <strong>50%</strong>
                </div>

                <div style={styles.fiftyFiftyPrizeStat}>
                  <span>Cause share</span>
                  <strong>50%</strong>
                </div>

                <p style={styles.helpText}>
                  Manual prize rows are not used for 50/50 raffles. Once drawn,
                  the admin payout snapshot records the paid ticket pot, winner
                  share, cause share and entry counts.
                </p>
              </div>
            ) : (
              <PrizeSettings
                raffleId={raffle.id}
                initialPrizes={config.prizes ?? []}
              />
            )}
          </div>
        </details>
      </section>

      <section style={styles.section}>
        <details style={styles.adminDetails}>
          <summary className="raffle-admin-summary" style={styles.adminSummary}>
            <div>
              <div style={styles.sectionEyebrow}>Section 3</div>

              <h2 style={styles.sectionTitle}>Draw centre</h2>

              <p style={styles.sectionDescription}>
                View winners, add postal tickets, run automatic draws and open
                the dramatic live draw.
              </p>
            </div>

            <div className="raffle-summary-pills" style={styles.summaryPillRow}>
              <span style={styles.neutralPill}>{winners.length} winners</span>

              <span style={styles.neutralPill}>
                {soldTicketsForDraw.length} eligible tickets
              </span>

              <span style={styles.adminSummaryToggle}>Open / close</span>
            </div>
          </summary>

          <div style={styles.adminDetailsBody}>
            {winners.length ? (
              <div style={styles.winnerList}>
                {winners.map((winner) => (
                  <div key={winner.id} style={styles.winnerCard}>
                    <div style={styles.winnerPrizeIcon}>
                      {winner.prize_position}
                    </div>

                    <div>
                      <div style={styles.winnerLabel}>Prize</div>

                      <div style={styles.winnerValue}>
                        {winner.prize_title || `Prize ${winner.prize_position}`}
                      </div>
                    </div>

                    <div>
                      <div style={styles.winnerLabel}>Ticket</div>

                      <div style={styles.winnerValue}>
                        #{winner.ticket_number}
                      </div>
                    </div>

                    <div>
                      <div style={styles.winnerLabel}>Colour</div>

                      <div style={styles.winnerValue}>
                        {winner.colour || "No colour"}
                      </div>
                    </div>

                    <div>
                      <div style={styles.winnerLabel}>Buyer</div>

                      <div style={styles.winnerValue}>
                        {winner.buyer_name || "Supporter"}
                      </div>

                      <div style={styles.winnerEmail}>
                        {winner.buyer_email || "—"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.emptyBox}>No winners yet.</div>
            )}

            <details open style={styles.drawDetails}>
              <summary style={styles.drawSummary}>
                <div>
                  <h3 style={styles.subTitle}>Manual postal ticket</h3>

                  <p style={styles.sectionDescription}>
                    Add a received postal entry into the eligible ticket pool.
                  </p>
                </div>

                <span style={styles.drawToggle}>Open / close</span>
              </summary>

              <form
                action={`/api/admin/raffles/${raffle.id}/manual-ticket`}
                method="post"
                style={styles.drawPanel}
              >
                <div className="raffle-two-column" style={styles.twoColumn}>
                  <Field label="Ticket number">
                    <input
                      name="ticket_number"
                      type="number"
                      min={1}
                      required
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Ticket colour">
                    <input
                      name="colour"
                      placeholder="Optional"
                      style={styles.input}
                    />
                  </Field>
                </div>

                <div className="raffle-two-column" style={styles.twoColumn}>
                  <Field label="Buyer name">
                    <input
                      name="buyer_name"
                      required
                      placeholder="Full name"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Buyer email">
                    <input
                      name="buyer_email"
                      type="email"
                      required
                      placeholder="name@example.com"
                      style={styles.input}
                    />
                  </Field>
                </div>

                <button type="submit" style={styles.drawButton}>
                  Add ticket to draw
                </button>
              </form>
            </details>

            <details open style={styles.drawDetails}>
              <summary style={styles.drawSummary}>
                <div>
                  <h3 style={styles.subTitle}>Live draw tools</h3>

                  <p style={styles.sectionDescription}>
                    Automatic draw and full-screen dramatic draw controls.
                  </p>
                </div>

                <span style={styles.drawToggle}>Open / close</span>
              </summary>

              <div className="raffle-draw-grid" style={styles.drawGrid}>
                <form
                  action={`/api/admin/raffles/${raffle.id}/draw/auto`}
                  method="post"
                  style={styles.drawPanel}
                >
                  <input
                    type="hidden"
                    name="from_prize"
                    value={autoDrawFromPrize}
                  />

                  <input
                    type="hidden"
                    name="to_prize"
                    value={autoDrawToPrize}
                  />

                  <h3 style={styles.subTitle}>Automatic random draw</h3>

                  <p style={styles.sectionDescription}>
                    Randomly draw remaining undrawn prizes using the saved auto
                    draw range.
                  </p>

                  <button type="submit" style={styles.drawButton}>
                    Auto draw remaining winners
                  </button>
                </form>

                <DramaticRaffleDraw
                  raffleId={raffle.id}
                  soldTickets={soldTicketsForDraw}
                  drawnPrizePositions={winners.map((winner) =>
                    Number(winner.prize_position),
                  )}
                  drawnTicketNumbers={winners.map((winner) =>
                    Number(winner.ticket_number),
                  )}
                />
              </div>
            </details>
          </div>
        </details>
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>

      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

function HeroMeta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.heroMetaCard}>
      <div style={styles.heroMetaLabel}>{label}</div>

      <div style={styles.heroMetaValue}>{value}</div>
    </div>
  );
}

function SnapshotStat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      style={{
        ...styles.snapshotStat,
        background: emphasis ? "#ffffff" : "#fffbeb",
      }}
    >
      <span style={styles.snapshotStatLabel}>{label}</span>
      <strong style={styles.snapshotStatValue}>{value}</strong>
    </div>
  );
}

function StatusMiniPill({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      style={{
        ...styles.statusMiniPill,
        background: active ? "#ecfdf5" : "#f8fafc",
        borderColor: active ? "#bbf7d0" : "#e2e8f0",
        color: active ? "#166534" : "#64748b",
      }}
    >
      {active ? "✓" : "•"} {label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}
const responsiveStyles = `
  .raffle-admin-page,
  .raffle-admin-page * {
    box-sizing: border-box;
  }

  .raffle-admin-page {
    overflow-x: hidden;
  }

  .raffle-admin-page img,
  .raffle-admin-page input,
  .raffle-admin-page textarea,
  .raffle-admin-page select,
  .raffle-admin-page button {
    max-width: 100%;
  }

  @media (max-width: 900px) {
    .raffle-hero {
      grid-template-columns: 1fr !important;
      min-height: auto !important;
    }

    .raffle-hero-image {
      max-width: 240px !important;
      height: 240px !important;
    }

    .raffle-summary-grid,
    .raffle-readiness-grid,
    .raffle-three-column,
    .raffle-two-column,
    .raffle-media-box,
    .raffle-draw-grid,
    .raffle-subtype-grid,
    .raffle-fifty-stats,
    .raffle-fifty-snapshot-grid,
    .raffle-payout-grid {
      grid-template-columns: 1fr !important;
    }

    .raffle-admin-summary {
      align-items: flex-start !important;
    }

    .raffle-summary-pills {
      width: 100% !important;
      justify-content: flex-start !important;
    }
  }

  @media (max-width: 640px) {
    .raffle-admin-page {
      padding: 18px 12px 44px !important;
    }

    .raffle-topbar {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }

    .raffle-topbar a {
      width: 100% !important;
      justify-content: center !important;
      text-align: center !important;
    }

    .raffle-hero,
    .raffle-readiness-panel {
      padding: 20px !important;
      border-radius: 24px !important;
    }

    .raffle-hero-image {
      max-width: 220px !important;
      height: 220px !important;
    }

    .raffle-hero h1 {
      font-size: clamp(32px, 11vw, 42px) !important;
      line-height: 1.02 !important;
    }

    .raffle-hero-meta {
      grid-template-columns: 1fr !important;
    }

    .raffle-preview-box {
      height: 190px !important;
    }

    .raffle-colour-grid {
      grid-template-columns: 1fr !important;
    }

    .raffle-offer-inputs {
      grid-template-columns: 1fr !important;
    }

    .raffle-admin-page button,
    .raffle-admin-page a {
      min-height: 46px !important;
    }

    .raffle-admin-page input[type="date"] {
      min-height: 46px !important;
      -webkit-appearance: none !important;
      appearance: none !important;
    }

    .raffle-readiness-value,
    .raffle-readiness-detail {
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
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
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
  },
  backLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 900,
  },
  publicLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 14,
  },
  campaignLimitBanner: {
    marginBottom: 16,
    padding: "clamp(18px, 4vw, 24px)",
    borderRadius: 24,
    background:
      "linear-gradient(135deg, #fff7ed 0%, #ffffff 48%, #eff6ff 100%)",
    border: "1px solid #fed7aa",
    boxShadow: "0 16px 38px rgba(15,23,42,0.08)",
  },
  campaignLimitEyebrow: {
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
  campaignLimitTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(24px, 5vw, 32px)",
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
  },
  campaignLimitText: {
    margin: "10px 0 0",
    color: "#475569",
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 820,
  },
  campaignLimitActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  campaignLimitPrimary: {
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
  campaignLimitSecondary: {
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
  validationBanner: {
    marginBottom: 16,
    padding: "clamp(18px, 4vw, 24px)",
    borderRadius: 24,
    background:
      "linear-gradient(135deg, #fff7ed 0%, #ffffff 48%, #eff6ff 100%)",
    border: "1px solid #fed7aa",
    boxShadow: "0 16px 38px rgba(15,23,42,0.08)",
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
    fontSize: "clamp(24px, 5vw, 32px)",
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
  },
  validationText: {
    margin: "10px 0 0",
    color: "#475569",
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 820,
  },
  successBanner: {
    marginBottom: 16,
    padding: "clamp(16px, 4vw, 20px)",
    borderRadius: 22,
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    boxShadow: "0 10px 28px rgba(15,23,42,0.05)",
  },
  successEyebrow: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 8,
  },
  successText: {
    margin: 0,
    color: "#166534",
    fontSize: 15,
    lineHeight: 1.6,
    fontWeight: 800,
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    gap: 20,
    alignItems: "center",
    padding: "clamp(20px, 5vw, 28px)",
    borderRadius: 28,
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.26), transparent 32%), linear-gradient(135deg, #0f172a 0%, #111827 55%, #020617 100%)",
    color: "#ffffff",
    marginBottom: 16,
    minHeight: 330,
    boxShadow: "0 18px 42px rgba(15,23,42,0.16)",
    overflow: "hidden",
    minWidth: 0,
  },
  heroContent: {
    minWidth: 0,
  },
  eyebrow: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 10,
  },
  heroTitleRow: {
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    minWidth: 0,
  },
  heroTitle: {
    margin: 0,
    fontSize: "clamp(34px, 8vw, 48px)",
    lineHeight: 1.03,
    letterSpacing: "-0.055em",
    overflowWrap: "anywhere",
    minWidth: 0,
  },
  statusPill: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 13,
    textTransform: "capitalize",
    fontWeight: 950,
    flexShrink: 0,
  },
  heroSlug: {
    margin: "9px 0 0",
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: 800,
    overflowWrap: "anywhere",
  },
  heroDescription: {
    margin: "14px 0 0",
    color: "#e2e8f0",
    lineHeight: 1.55,
    maxWidth: 760,
    overflowWrap: "anywhere",
  },
  heroDescriptionMuted: {
    margin: "14px 0 0",
    color: "#94a3b8",
    lineHeight: 1.55,
  },
  heroMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))",
    gap: 10,
    marginTop: 22,
    maxWidth: 700,
  },
  heroMetaCard: {
    padding: "12px 14px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    minWidth: 0,
  },
  heroMetaLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 900,
  },
  heroMetaValue: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 950,
    marginTop: 4,
    overflowWrap: "anywhere",
  },
  heroImageWrap: {
    width: "100%",
    maxWidth: 280,
    height: 280,
    borderRadius: 22,
    background: "#1e293b",
    border: "1px solid rgba(255,255,255,0.14)",
    overflow: "hidden",
    alignSelf: "center",
    justifySelf: "center",
    boxShadow: "0 18px 36px rgba(0,0,0,0.22)",
  },
  heroImage: {
    width: "100%",
    height: "100%",
    maxHeight: 280,
    display: "block",
  },
  readinessPanel: {
    display: "grid",
    gap: 16,
    padding: 18,
    borderRadius: 24,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 56%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    boxShadow: "0 8px 28px rgba(15,23,42,0.055)",
    marginBottom: 16,
    minWidth: 0,
  },
  readinessHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  readinessEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },
  readinessTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(22px, 5vw, 28px)",
    letterSpacing: "-0.045em",
    lineHeight: 1.05,
    overflowWrap: "anywhere",
  },
  readinessIntro: {
    margin: "7px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 750,
    maxWidth: 760,
  },
  readinessStatusPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
  },
  readinessGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  readinessItem: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 10,
    alignItems: "start",
    padding: 13,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  readinessToneDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    border: "1px solid",
    marginTop: 4,
  },
  readinessContent: {
    display: "grid",
    gap: 3,
    minWidth: 0,
  },
  readinessLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  readinessValue: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },
  readinessDetail: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
  },
  summaryValue: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
    marginTop: 5,
    overflowWrap: "anywhere",
  },
  fiftyFiftyNotice: {
    display: "grid",
    gap: 12,
    padding: "clamp(18px, 4vw, 22px)",
    borderRadius: 24,
    background:
      "linear-gradient(135deg, #fffbeb 0%, #ffffff 48%, #f8fafc 100%)",
    border: "1px solid #fde68a",
    boxShadow: "0 10px 28px rgba(15,23,42,0.05)",
    marginBottom: 16,
    minWidth: 0,
    overflow: "hidden",
  },
  fiftyFiftyNoticeEyebrow: {
    justifySelf: "start",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #facc15",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  fiftyFiftyNoticeTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(22px, 4vw, 28px)",
    letterSpacing: "-0.035em",
  },
  fiftyFiftyNoticeText: {
    margin: 0,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
    maxWidth: 900,
  },
  fiftyFiftyStats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  fiftyFiftyStat: {
    display: "grid",
    gap: 4,
    padding: 14,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #fde68a",
    color: "#92400e",
    minWidth: 0,
  },
  fiftyFiftySnapshotCard: {
    display: "grid",
    gap: 16,
    padding: "clamp(18px, 4vw, 24px)",
    borderRadius: 26,
    background:
      "linear-gradient(135deg, #0f172a 0%, #111827 54%, #1e293b 100%)",
    border: "1px solid #334155",
    boxShadow: "0 18px 42px rgba(15,23,42,0.16)",
    color: "#ffffff",
    marginBottom: 16,
    minWidth: 0,
    overflow: "hidden",
  },
  fiftyFiftySnapshotHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
  },
  fiftyFiftySnapshotEyebrow: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(250,204,21,0.12)",
    color: "#fde68a",
    border: "1px solid rgba(250,204,21,0.38)",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 10,
  },
  fiftyFiftySnapshotTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: "clamp(24px, 5vw, 34px)",
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
  },
  fiftyFiftySnapshotText: {
    margin: "8px 0 0",
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 1.6,
    maxWidth: 760,
  },
  payoutStatusPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "9px 13px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 13,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  fiftyFiftySnapshotGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  snapshotStat: {
    display: "grid",
    gap: 6,
    padding: 16,
    borderRadius: 18,
    border: "1px solid #fde68a",
    color: "#92400e",
    minWidth: 0,
  },
  snapshotStatLabel: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: 950,
  },
  snapshotStatValue: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },
  payoutForm: {
    display: "grid",
    gap: 14,
    padding: 16,
    borderRadius: 20,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
  },
  payoutFormHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  payoutFormTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 20,
    letterSpacing: "-0.02em",
  },
  payoutFormText: {
    margin: "5px 0 0",
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 1.5,
  },
  payoutGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
  },
  payoutMetaRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    paddingTop: 4,
  },
  payoutMetaText: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 1.45,
  },
  payoutSubmitButton: {
    padding: "12px 18px",
    borderRadius: 999,
    border: "1px solid #facc15",
    background: "#facc15",
    color: "#78350f",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(250,204,21,0.18)",
    minHeight: 44,
  },
  progressCard: {
    padding: 16,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 16,
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 10,
    flexWrap: "wrap",
  },
  progressPercent: {
    color: "#166534",
    fontWeight: 950,
    fontSize: 18,
  },
  progressTrack: {
    height: 11,
    background: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #16a34a, #22c55e)",
    borderRadius: 999,
  },
  actionsCard: {
    display: "grid",
    gap: 14,
    padding: 18,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 16,
    minWidth: 0,
    overflow: "hidden",
  },
  section: {
    padding: "clamp(16px, 4vw, 18px)",
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 16,
    minWidth: 0,
    overflow: "hidden",
  },
  sectionEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },
  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(22px, 5vw, 26px)",
    letterSpacing: "-0.035em",
    overflowWrap: "anywhere",
  },
  sectionDescription: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },
  adminDetails: {
    display: "grid",
    gap: 0,
    minWidth: 0,
  },
  adminSummary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "center",
    cursor: "pointer",
    listStyle: "none",
    flexWrap: "wrap",
    minWidth: 0,
  },
  adminSummaryToggle: {
    flexShrink: 0,
    padding: "8px 12px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  adminDetailsBody: {
    display: "grid",
    gap: 14,
    marginTop: 16,
    minWidth: 0,
  },
  summaryPillRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  statusMiniPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 11px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
  },
  fiftyFiftyMiniPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 11px",
    borderRadius: 999,
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #facc15",
    fontSize: 12,
    fontWeight: 950,
  },
  neutralPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 11px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#334155",
    border: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 950,
  },
  form: {
    display: "grid",
    gap: 14,
    minWidth: 0,
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
    gap: 12,
  },
  threeColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
    gap: 12,
    alignItems: "start",
  },
  subtypeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
    gap: 12,
  },
  subtypeCard: {
    display: "grid",
    gap: 8,
    padding: 14,
    borderRadius: 18,
    border: "1px solid",
    cursor: "pointer",
    minWidth: 0,
  },
  subtypeTitle: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: 950,
  },
  subtypeText: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 750,
  },
  fiftyFiftyInlineNotice: {
    display: "grid",
    gap: 6,
    padding: 14,
    borderRadius: 18,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 800,
  },
  field: {
    display: "grid",
    gap: 6,
    minWidth: 0,
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
  },
  input: {
    width: "100%",
    minHeight: 46,
    padding: "11px 12px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 16,
    boxSizing: "border-box",
    minWidth: 0,
  },
  textarea: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 16,
    resize: "vertical",
    boxSizing: "border-box",
    minWidth: 0,
  },
  mediaBox: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: 16,
    padding: 14,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  mediaControls: {
    minWidth: 0,
  },
  subTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    letterSpacing: "-0.01em",
  },
  previewBox: {
    height: 220,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    overflow: "hidden",
  },
  innerPanel: {
    display: "grid",
    gap: 14,
    padding: "clamp(14px, 4vw, 16px)",
    borderRadius: 20,
    background:
      "linear-gradient(135deg, #f8fafc 0%, #ffffff 52%, #eff6ff 100%)",
    border: "1px solid #e2e8f0",
    minWidth: 0,
    overflow: "hidden",
  },
  innerHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  innerEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },
  colourGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 135px), 1fr))",
    gap: 10,
  },
  colourCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    border: "1px solid",
    cursor: "pointer",
    fontWeight: 900,
    minWidth: 0,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 999,
    border: "1px solid",
    flexShrink: 0,
  },
  colourText: {
    display: "grid",
    gap: 2,
    color: "#0f172a",
    minWidth: 0,
  },
  disabledPanel: {
    display: "grid",
    gap: 8,
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
  },
  disabledEyebrow: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  offerList: {
    display: "grid",
    gap: 10,
  },
  offerCard: {
    display: "grid",
    gap: 10,
    padding: 12,
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    background: "#ffffff",
    minWidth: 0,
  },
  offerBadge: {
    justifySelf: "start",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#ecfdf5",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontSize: 12,
    fontWeight: 950,
  },
  offerInputs: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
    gap: 10,
    alignItems: "end",
  },
  checkboxLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    fontWeight: 950,
    color: "#334155",
    cursor: "pointer",
  },
  helpText: {
    color: "#64748b",
    fontSize: 13,
    margin: 0,
    overflowWrap: "anywhere",
  },
  submitBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: 16,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  submitButton: {
    padding: "13px 20px",
    border: "none",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(22,131,248,0.22)",
    minHeight: 44,
  },
  mutedSmall: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 3,
  },
  fiftyFiftyPrizePanel: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
    gap: 12,
    padding: "clamp(14px, 4vw, 16px)",
    borderRadius: 22,
    background:
      "linear-gradient(135deg, #fffbeb 0%, #ffffff 48%, #f8fafc 100%)",
    border: "1px solid #fde68a",
    minWidth: 0,
    overflow: "hidden",
  },
  fiftyFiftyPrizeStat: {
    display: "grid",
    gap: 4,
    padding: 14,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #fde68a",
    color: "#92400e",
  },
  winnerList: {
    display: "grid",
    gap: 10,
    marginBottom: 14,
  },
  winnerCard: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    alignItems: "center",
    minWidth: 0,
  },
  winnerPrizeIcon: {
    width: 38,
    height: 38,
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 950,
  },
  winnerLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    marginBottom: 4,
  },
  winnerValue: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },
  winnerEmail: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 3,
    overflowWrap: "anywhere",
  },
  emptyBox: {
    padding: 16,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 900,
    marginBottom: 14,
  },
  drawDetails: {
    padding: 0,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    marginTop: 14,
  },
  drawSummary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    cursor: "pointer",
    listStyle: "none",
    padding: 16,
    background: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    flexWrap: "wrap",
  },
  drawToggle: {
    flexShrink: 0,
    padding: "8px 12px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  drawGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
    gap: 14,
    padding: 16,
  },
  drawPanel: {
    padding: 16,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    display: "grid",
    gap: 12,
    minWidth: 0,
  },
  drawButton: {
    padding: "13px 20px",
    border: "none",
    borderRadius: 999,
    background: "#16a34a",
    color: "#ffffff",
    fontWeight: 950,
    cursor: "pointer",
    minHeight: 44,
  },
};
