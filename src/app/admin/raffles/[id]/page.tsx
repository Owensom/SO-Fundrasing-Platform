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

      <section className="raffle-hero" style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Raffle editor</div>
                    <div style={styles.heroTitleRow}>
            <h1 style={styles.heroTitle}>{raffle.title}</h1>

            <div style={{ ...styles.statusPill, ...statusStyle }}>
              {raffle.status}
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
                      Configure pricing, number range, colours and bundle
                      offers.
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

                <input
                  type="hidden"
                  name="offer_count"
                  value={offerRows.length}
                />

                <div style={styles.offerList}>
                  {offerRows.map((offer, index) => (
                    <div key={`${offer.id}-${index}`} style={styles.offerCard}>
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
              </section>

              <section style={styles.innerPanel}>
                <div style={styles.innerHeader}>
                  <div>
                    <div style={styles.innerEyebrow}>Compliance</div>

                    <h3 style={styles.subTitle}>Legal & postal entry</h3>

                    <p style={styles.sectionDescription}>
                      Add a skill-based entry question and the free postal entry
                      route shown on the public raffle page.
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
        <details open={!prizesConfigured} style={styles.adminDetails}>
          <summary className="raffle-admin-summary" style={styles.adminSummary}>
            <div>
              <div style={styles.sectionEyebrow}>Section 2</div>

              <h2 style={styles.sectionTitle}>Prize management</h2>

              <p style={styles.sectionDescription}>
                Manage prize names, descriptions and public visibility.
              </p>
            </div>

            <span style={styles.adminSummaryToggle}>Open / close</span>
          </summary>

          <div style={styles.adminDetailsBody}>
            <PrizeSettings
              raffleId={raffle.id}
              initialPrizes={config.prizes ?? []}
            />
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
    .raffle-three-column,
    .raffle-two-column,
    .raffle-media-box,
    .raffle-draw-grid {
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

    .raffle-hero {
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
