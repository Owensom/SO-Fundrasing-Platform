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
};

type SoldTicketRow = {
  ticket_number: number;
  colour: string | null;
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

function formatDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 16);
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

function formatMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(Number(cents || 0) / 100);
  } catch {
    return `${(Number(cents || 0) / 100).toFixed(2)} ${currency || "GBP"}`;
  }
}

function getStatusStyle(status: string): CSSProperties {
  const clean = status.toLowerCase();

  if (clean === "published") {
    return {
      background: "#ecfdf5",
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
      background: "#eff6ff",
      borderColor: "#bfdbfe",
      color: "#1d4ed8",
    };
  }

  return {
    background: "#f8fafc",
    borderColor: "#e2e8f0",
    color: "#475569",
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

  const invalidDrawDateTime =
    resolvedSearchParams.error === "invalid_draw_datetime";

  const invalidPostalDateTime =
    resolvedSearchParams.error === "invalid_postal_datetime";

  const saveFailed = resolvedSearchParams.error === "save_failed";

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
      select *
      from raffle_winners
      where raffle_id = $1
      order by prize_position asc
    `,
    [raffle.id],
  );

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

  const soldByColour = soldTicketRows.reduce((acc, ticket) => {
    const key = ticket.colour || "No colour";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const legalQuestionEnabled =
    isConfigured(config.question?.text) &&
    isConfigured(config.question?.answer);

  const postalEntryEnabled =
    isConfigured(config.free_entry?.address) ||
    isConfigured(config.free_entry?.instructions);

  const prizesConfigured =
    Array.isArray(config.prizes) && config.prizes.length > 0;

  return (
    <main className="raffle-admin-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="raffle-topbar" style={styles.topBar}>
        <Link href="/admin/raffles" style={styles.backLink}>
          ← Back to raffles
        </Link>

        <Link
          href={`/r/${raffle.slug}?adminReturn=/admin/raffles/${raffle.id}`}
          target="_blank"
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

      {invalidDrawDateTime || invalidPostalDateTime || saveFailed ? (
        <section className="raffle-validation-banner" style={styles.validationBanner}>
          <div style={styles.validationEyebrow}>
            {saveFailed ? "Save issue" : "Date format issue"}
          </div>

          <h2 style={styles.validationTitle}>
            {invalidDrawDateTime
              ? "Please check the draw date."
              : invalidPostalDateTime
                ? "Please check the postal closing date."
                : "The raffle could not be saved."}
          </h2>

          <p style={styles.validationText}>
            {invalidDrawDateTime
              ? "The draw date must use the browser date and time picker value. Clear the field if no draw date is needed yet."
              : invalidPostalDateTime
                ? "The postal entry closing date must use the browser date and time picker value. Clear the field if no postal closing date is needed yet."
                : "Please check the form values and try again. The raffle has not been changed."}
          </p>
        </section>
      ) : null}

      <section className="raffle-hero" style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>
            {isFiftyFifty ? "50/50 raffle editor" : "Raffle editor"}
          </div>

          <div style={styles.heroTitleRow}>
            <h1 style={styles.heroTitle}>{raffle.title}</h1>

            <div style={styles.heroPillRow}>
              {isFiftyFifty ? (
                <div style={styles.fiftyFiftyHeroPill}>50/50</div>
              ) : null}

              <div style={{ ...styles.statusPill, ...statusStyle }}>
                {raffle.status}
              </div>
            </div>
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
            <HeroMeta
              label="Type"
              value={isFiftyFifty ? "50/50 raffle" : "Standard raffle"}
            />

            <HeroMeta label="Draw" value={formatDrawDate(raffle.draw_at)} />

            <HeroMeta
              label="Ticket sales"
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
                ? "#1e293b"
                : "linear-gradient(135deg, #ffffff 0%, #f8fafc 52%, #eff6ff 100%)",
            }}
          />
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
            first release. The winner prize will be calculated from paid ticket
            sales in a later draw-snapshot phase.
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
              <strong>Manual tracker later</strong>
            </div>
          </div>
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
          <summary className="raffle-admin-summary" style={styles.adminSummary}>
            <div>
              <div style={styles.sectionEyebrow}>Section 1</div>

              <h2 style={styles.sectionTitle}>Edit raffle</h2>

              <p style={styles.sectionDescription}>
                Update the public details, pricing, legal settings, colours and
                offer bundles.
              </p>
            </div>

            <div className="raffle-summary-pills" style={styles.summaryPillRow}>
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

                <div className="raffle-subtype-grid" style={styles.subtypeGrid}>
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
                      name="draw_at"
                      type="datetime-local"
                      defaultValue={formatDateTimeLocal(raffle.draw_at)}
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

                <Field label="Postal entry closing date">
                  <input
                    name="free_entry_closes_at"
                    type="datetime-local"
                    defaultValue={formatDateTimeLocal(
                      config.free_entry?.closes_at,
                    )}
                    style={styles.input}
                  />
                </Field>

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
                  ? "The winner prize is calculated automatically from paid ticket sales."
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
                  Manual prize rows are not used for 50/50 raffles. The final
                  winner prize and cause share will be snapshotted at draw time
                  in a later phase.
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

  .raffle-admin-page input,
  .raffle-admin-page textarea,
  .raffle-admin-page select,
  .raffle-admin-page button,
  .raffle-admin-page img {
    max-width: 100%;
  }

  .raffle-admin-summary::-webkit-details-marker {
    display: none;
  }

  @media (max-width: 980px) {
    .raffle-hero {
      grid-template-columns: 1fr !important;
    }

    .raffle-hero-image {
      min-height: 260px !important;
    }

    .raffle-summary-grid,
    .raffle-three-column,
    .raffle-two-column,
    .raffle-media-box,
    .raffle-subtype-grid,
    .raffle-draw-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 760px) {
    .raffle-admin-page {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 auto !important;
      padding: 18px 12px 44px !important;
    }

    .raffle-topbar {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 10px !important;
      margin-bottom: 16px !important;
    }

    .raffle-topbar a {
      width: 100% !important;
      min-height: 50px !important;
      text-align: center !important;
      justify-content: center !important;
      padding: 13px 16px !important;
    }

    .raffle-admin-page section,
    .raffle-admin-page details,
    .raffle-admin-page div,
    .raffle-admin-page label {
      min-width: 0 !important;
      max-width: 100% !important;
    }

    .raffle-admin-page h1 {
      font-size: clamp(34px, 12vw, 46px) !important;
      line-height: 1.02 !important;
      letter-spacing: -0.055em !important;
      overflow-wrap: anywhere !important;
    }

    .raffle-admin-page h2 {
      font-size: clamp(26px, 9vw, 34px) !important;
      line-height: 1.05 !important;
      overflow-wrap: anywhere !important;
    }

    .raffle-admin-page h3,
    .raffle-admin-page p,
    .raffle-admin-page span,
    .raffle-admin-page strong {
      overflow-wrap: anywhere !important;
    }

    .raffle-admin-summary {
      display: grid !important;
      grid-template-columns: 1fr !important;
    }

    .raffle-summary-pills {
      justify-content: flex-start !important;
    }

    .raffle-fifty-stats {
      grid-template-columns: 1fr !important;
    }

    .raffle-offer-inputs {
      grid-template-columns: 1fr !important;
    }

    .raffle-admin-page input,
    .raffle-admin-page textarea,
    .raffle-admin-page select {
      font-size: 16px !important;
    }

    .raffle-admin-page button,
    .raffle-admin-page a {
      min-height: 46px !important;
    }
  }
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1120,
    margin: "40px auto",
    padding: "0 16px 56px",
    overflowX: "hidden",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  backLink: {
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
  publicLink: {
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
  campaignLimitBanner: {
    marginBottom: 18,
    padding: "clamp(18px, 4vw, 24px)",
    borderRadius: 26,
    background:
      "linear-gradient(135deg, #fff7ed 0%, #ffffff 48%, #eff6ff 100%)",
    border: "1px solid #fed7aa",
    boxShadow: "0 16px 38px rgba(15,23,42,0.08)",
    minWidth: 0,
    overflow: "hidden",
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
    maxWidth: 840,
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
    marginBottom: 18,
    padding: "clamp(18px, 4vw, 24px)",
    borderRadius: 26,
    background:
      "linear-gradient(135deg, #fff7ed 0%, #ffffff 48%, #eff6ff 100%)",
    border: "1px solid #fed7aa",
    boxShadow: "0 16px 38px rgba(15,23,42,0.08)",
    minWidth: 0,
    overflow: "hidden",
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
    maxWidth: 840,
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.12fr) minmax(320px, 0.88fr)",
    gap: 20,
    alignItems: "stretch",
    padding: "clamp(20px, 4vw, 28px)",
    borderRadius: 30,
    background:
      "radial-gradient(circle at top left, rgba(59,130,246,0.22), transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 54%, #172554 100%)",
    color: "#ffffff",
    overflow: "hidden",
    boxShadow: "0 24px 60px rgba(15,23,42,0.18)",
    marginBottom: 16,
  },
  heroContent: {
    minWidth: 0,
  },
  eyebrow: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 12,
  },
  heroTitleRow: {
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  heroTitle: {
    margin: 0,
    fontSize: "clamp(36px, 5vw, 54px)",
    lineHeight: 1,
    letterSpacing: "-0.06em",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    maxWidth: 720,
  },
  heroPillRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  statusPill: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 13,
    textTransform: "capitalize",
    fontWeight: 900,
  },
  fiftyFiftyHeroPill: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid #facc15",
    fontSize: 13,
    fontWeight: 950,
    background: "#fef3c7",
    color: "#92400e",
  },
  heroSlug: {
    margin: "10px 0 0",
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 800,
    wordBreak: "break-word",
  },
  heroDescription: {
    margin: "14px 0 0",
    color: "#dbeafe",
    lineHeight: 1.65,
    maxWidth: 760,
    fontSize: 16,
  },
  heroDescriptionMuted: {
    margin: "14px 0 0",
    color: "#bfdbfe",
    lineHeight: 1.65,
    maxWidth: 760,
    fontSize: 16,
  },
  heroMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
    gap: 10,
    marginTop: 22,
  },
  heroMetaCard: {
    padding: "13px 14px",
    borderRadius: 18,
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(255,255,255,0.16)",
    minWidth: 0,
  },
  heroMetaLabel: {
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 900,
  },
  heroMetaValue: {
    marginTop: 4,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 950,
    letterSpacing: "-0.02em",
  },
  heroImageWrap: {
    minHeight: 320,
    borderRadius: 24,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.18)",
    background: "#ffffff",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    padding: 15,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
  },
  summaryValue: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: 950,
    marginTop: 5,
    wordBreak: "break-word",
  },
  fiftyFiftyNotice: {
    padding: "clamp(18px, 4vw, 24px)",
    borderRadius: 26,
    background:
      "linear-gradient(135deg, #fffbeb 0%, #ffffff 48%, #f8fafc 100%)",
    border: "1px solid #fde68a",
    marginBottom: 16,
    boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
  },
  fiftyFiftyNoticeEyebrow: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 8,
  },
  fiftyFiftyNoticeTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(24px, 4vw, 32px)",
    lineHeight: 1.08,
    letterSpacing: "-0.04em",
  },
  fiftyFiftyNoticeText: {
    margin: "10px 0 0",
    color: "#475569",
    lineHeight: 1.6,
    fontSize: 15,
  },
  fiftyFiftyStats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    marginTop: 16,
  },
  fiftyFiftyStat: {
    display: "grid",
    gap: 4,
    padding: 14,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #fde68a",
    color: "#92400e",
  },
  progressCard: {
    padding: 16,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    marginBottom: 16,
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  progressPercent: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  progressTrack: {
    height: 12,
    borderRadius: 999,
    background: "#e2e8f0",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(135deg, #1683f8, #1d4ed8)",
  },
  actionsCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    marginBottom: 16,
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  section: {
    padding: "clamp(16px, 4vw, 20px)",
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
    overflow: "hidden",
    marginBottom: 16,
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
    fontSize: 24,
    letterSpacing: "-0.03em",
  },
  sectionDescription: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
  },
  adminDetails: {
    borderRadius: 20,
    minWidth: 0,
  },
  adminSummary: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    cursor: "pointer",
    listStyle: "none",
  },
  summaryPillRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  statusMiniPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 900,
  },
  fiftyFiftyMiniPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid #facc15",
    background: "#fef3c7",
    color: "#92400e",
    fontSize: 12,
    fontWeight: 950,
  },
  neutralPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#475569",
    fontSize: 12,
    fontWeight: 900,
  },
  adminSummaryToggle: {
    display: "inline-flex",
    padding: "8px 10px",
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
    gap: 16,
    marginTop: 16,
  },
  form: {
    display: "grid",
    gap: 16,
    minWidth: 0,
  },
  innerPanel: {
    display: "grid",
    gap: 14,
    padding: "clamp(14px, 4vw, 16px)",
    borderRadius: 20,
    background: "#f8fafc",
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
  subTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    letterSpacing: "-0.01em",
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    minWidth: 0,
  },
  threeColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    minWidth: 0,
  },
  field: {
    display: "grid",
    gap: 6,
    minWidth: 0,
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    maxWidth: "100%",
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
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
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
  previewBox: {
    minHeight: 240,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    overflow: "hidden",
  },
  subtypeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    minWidth: 0,
  },
  subtypeCard: {
    display: "grid",
    gap: 8,
    padding: 16,
    borderRadius: 20,
    border: "1px solid",
    cursor: "pointer",
    color: "#0f172a",
  },
  subtypeTitle: {
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.02em",
  },
  subtypeText: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 750,
  },
  fiftyFiftyInlineNotice: {
    display: "grid",
    gap: 6,
    padding: 16,
    borderRadius: 18,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    fontSize: 14,
    lineHeight: 1.55,
    fontWeight: 800,
  },
  colourGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
    gap: 10,
  },
  colourCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    border: "1px solid",
    minWidth: 0,
  },
  swatch: {
    width: 18,
    height: 18,
    borderRadius: 999,
    border: "1px solid",
    flexShrink: 0,
  },
  colourText: {
    display: "grid",
    gap: 2,
    color: "#0f172a",
    fontSize: 13,
    minWidth: 0,
  },
  disabledPanel: {
    display: "grid",
    gap: 8,
    padding: 16,
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
    gap: 12,
  },
  offerCard: {
    display: "grid",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  offerBadge: {
    justifySelf: "start",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 950,
  },
  offerInputs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr auto",
    gap: 10,
    alignItems: "end",
  },
  checkboxLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minHeight: 46,
    fontWeight: 900,
    color: "#334155",
    cursor: "pointer",
  },
  helpText: {
    color: "#64748b",
    fontSize: 13,
    margin: 0,
    lineHeight: 1.45,
  },
  mutedSmall: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 3,
  },
  submitBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: 16,
    borderRadius: 20,
    background: "#ffffff",
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
  },
  fiftyFiftyPrizePanel: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    padding: 16,
    borderRadius: 22,
    background:
      "linear-gradient(135deg, #fffbeb 0%, #ffffff 48%, #f8fafc 100%)",
    border: "1px solid #fde68a",
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
  },
  winnerCard: {
    display: "grid",
    gridTemplateColumns: "56px repeat(4, minmax(0, 1fr))",
    gap: 12,
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  winnerPrizeIcon: {
    width: 42,
    height: 42,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: 950,
  },
  winnerLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
  },
  winnerValue: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 950,
    marginTop: 3,
    wordBreak: "break-word",
  },
  winnerEmail: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 3,
    wordBreak: "break-word",
  },
  emptyBox: {
    padding: 18,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 850,
  },
  drawDetails: {
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    marginTop: 14,
  },
  drawSummary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    cursor: "pointer",
    listStyle: "none",
  },
  drawToggle: {
    display: "inline-flex",
    padding: "8px 10px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    flexShrink: 0,
  },
  drawPanel: {
    display: "grid",
    gap: 12,
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  drawGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.85fr) minmax(0, 1.15fr)",
    gap: 14,
    marginTop: 14,
  },
  drawButton: {
    justifySelf: "start",
    padding: "12px 16px",
    border: "none",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: 950,
    cursor: "pointer",
  },
};
