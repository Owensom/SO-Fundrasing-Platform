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

export default async function AdminRafflePage({ params }: PageProps) {
  const { id } = await params;

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
    const soldCount = Number(raffle.sold_tickets || 0);
  const totalTickets = Number(raffle.total_tickets || 0);
  const remainingTickets = Math.max(0, totalTickets - soldCount);
  const progressPercent = getProgressPercent(soldCount, totalTickets);

  const prizesConfigured = Array.isArray(config.prizes)
    ? config.prizes.length > 0
    : false;

  const legalQuestionConfigured = Boolean(
    config.question?.text && config.question?.answer,
  );

  const freeEntryConfigured = Boolean(
    config.free_entry?.address ||
      config.free_entry?.instructions ||
      config.free_entry?.closes_at,
  );

  const soldByColour = colours.reduce<Record<string, number>>(
    (accumulator, colour) => {
      accumulator[colour] = 0;
      return accumulator;
    },
    {},
  );

  const soldTicketsResult = await query<SoldTicketRow>(
    `
      select
        ticket_number,
        colour
      from raffle_tickets
      where raffle_id = $1
      order by ticket_number asc
    `,
    [raffle.id],
  );

  for (const row of soldTicketsResult.rows) {
    const colour = row.colour || "";

    if (!colour) continue;

    soldByColour[colour] = (soldByColour[colour] || 0) + 1;
  }

  const soldTicketsForDraw = soldTicketsResult.rows.map((ticket) => ({
    ticketNumber: Number(ticket.ticket_number),
    colour: ticket.colour || "",
  }));

  const winnersResult = await query<WinnerRow>(
    `
      select
        id,
        raffle_id,
        prize_position,
        prize_title,
        ticket_number,
        colour,
        buyer_name,
        buyer_email
      from raffle_winners
      where raffle_id = $1
      order by prize_position asc
    `,
    [raffle.id],
  );

  const winners = winnersResult.rows;

  return (
    <main className="raffle-admin-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section style={styles.topBar}>
        <Link href="/admin/raffles" style={styles.backLink}>
          ← Back to raffles
        </Link>

        <div style={styles.topBarActions}>
          <Link
            href={`/r/${raffle.slug}`}
            target="_blank"
            style={styles.publicLink}
          >
            View public page
          </Link>

          <RaffleAdminActions raffleId={raffle.id} />
        </div>
      </section>

      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Raffle administration</div>

          <div style={styles.heroTitleRow}>
            <h1 style={styles.heroTitle}>{raffle.title}</h1>

            <span
              style={{
                ...styles.statusPill,
                ...getStatusStyle(raffle.status),
              }}
            >
              {raffle.status}
            </span>
          </div>

          <p style={styles.heroSlug}>/r/{raffle.slug}</p>

          {raffle.description ? (
            <p style={styles.heroDescription}>{raffle.description}</p>
          ) : (
            <p style={styles.heroDescriptionMuted}>
              Add a description to explain the raffle and showcase prizes.
            </p>
          )}

          <div style={styles.heroMetaGrid}>
            <HeroMeta
              label="Draw date"
              value={formatDrawDate(raffle.draw_at)}
            />

            <HeroMeta
              label="Ticket price"
              value={formatMoney(
                Number(raffle.ticket_price_cents || 0),
                raffle.currency || "GBP",
              )}
            />

            <HeroMeta
              label="Revenue"
              value={formatMoney(
                Number(raffle.revenue_cents || 0),
                raffle.currency || "GBP",
              )}
            />

            <HeroMeta label="Tickets sold" value={soldCount} />
          </div>
        </div>

        <div style={styles.heroImageWrap}>
          <img
            src={raffle.image_url || DEFAULT_RAFFLE_IMAGE}
            alt={raffle.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: imageObjectPosition,
              display: "block",
            }}
          />
        </div>
      </section>

      <section style={styles.summaryGrid}>
        <SummaryCard label="Sold tickets" value={soldCount} />

        <SummaryCard label="Remaining" value={remainingTickets} />

        <SummaryCard
          label="Revenue"
          value={formatMoney(
            Number(raffle.revenue_cents || 0),
            raffle.currency || "GBP",
          )}
        />

        <SummaryCard label="Colours" value={colours.length} />

        <SummaryCard label="Offers" value={offers.length} />

        <SummaryCard label="Winners drawn" value={winners.length} />
      </section>

      <section style={styles.progressCard}>
        <div style={styles.progressHeader}>
          <div>
            <div style={styles.sectionEyebrow}>Sales progress</div>

            <h2 style={styles.sectionTitle}>Ticket sales</h2>
          </div>

          <div style={styles.progressPercent}>{progressPercent}% sold</div>
        </div>

        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${progressPercent}%`,
            }}
          />
        </div>
      </section>

      <section style={styles.actionsCard}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionEyebrow}>Configuration overview</div>

            <h2 style={styles.sectionTitle}>Raffle readiness</h2>

            <p style={styles.sectionDescription}>
              Quick overview of images, legal setup and prize configuration.
            </p>
          </div>
        </div>

        <div style={styles.summaryPillRow}>
          <StatusMiniPill
            label="Custom image"
            active={Boolean(raffle.image_url)}
          />

          <StatusMiniPill
            label="Legal question"
            active={legalQuestionConfigured}
          />

          <StatusMiniPill
            label="Free postal entry"
            active={freeEntryConfigured}
          />

          <StatusMiniPill
            label="Prizes configured"
            active={prizesConfigured}
          />
        </div>
      </section>

      <section style={styles.section}>
        <details open style={styles.adminDetails}>
          <summary style={styles.adminSummary}>
            <div>
              <div style={styles.sectionEyebrow}>Section 1</div>

              <h2 style={styles.sectionTitle}>Campaign settings</h2>

              <p style={styles.sectionDescription}>
                Update the public raffle page, ticket setup, legal details and
                campaign image.
              </p>
            </div>

            <span style={styles.adminSummaryToggle}>Open / close</span>
          </summary>

          <div style={styles.adminDetailsBody}>
            <form
              action={`/api/admin/raffles/${raffle.id}`}
              method="post"
              style={styles.form}
            >
              <section style={styles.innerPanel}>
                <div style={styles.innerHeader}>
                  <div>
                    <div style={styles.innerEyebrow}>Public campaign</div>

                    <h3 style={styles.subTitle}>Title & content</h3>

                    <p style={styles.sectionDescription}>
                      Control the public-facing campaign content and imagery.
                    </p>
                  </div>
                </div>
                                <div style={styles.twoColumn}>
                  <Field label="Title">
                    <input
                      name="title"
                      required
                      defaultValue={raffle.title}
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Slug">
                    <input
                      name="slug"
                      required
                      defaultValue={raffle.slug}
                      style={styles.input}
                    />
                  </Field>
                </div>

                <Field label="Description">
                  <textarea
                    name="description"
                    rows={4}
                    defaultValue={raffle.description || ""}
                    style={styles.textarea}
                  />
                </Field>

                <div style={styles.mediaPanel}>
                  <div style={styles.mediaPanelLeft}>
                    <div style={styles.mediaHeader}>
                      <div>
                        <div style={styles.mediaEyebrow}>Campaign media</div>

                        <h3 style={styles.mediaTitle}>Raffle image</h3>

                        <p style={styles.mediaDescription}>
                          Upload or replace the public image, then choose the
                          crop focus. If no image is uploaded, the SO default
                          raffle image is shown.
                        </p>
                      </div>
                    </div>

                    <ImageFocusUploadField
                      currentImageUrl={raffle.image_url || ""}
                      currentFocusX={imageFocusX}
                      currentFocusY={imageFocusY}
                      label="Raffle image"
                      previewAlt={raffle.title}
                      onImageUrlChange={() => {}}
                      onFocusXChange={() => {}}
                      onFocusYChange={() => {}}
                      subscriptionTier={
                        tenantSettings?.subscription_tier
                      }
                      customImagesAllowed={
                        customImagesCapability.allowed
                      }
                    />
                  </div>

                  <div style={styles.mediaPreview}>
                    <img
                      src={raffle.image_url || DEFAULT_RAFFLE_IMAGE}
                      alt={raffle.title}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: imageObjectPosition,
                        display: "block",
                      }}
                    />
                  </div>
                </div>

                <div style={styles.settingsGrid}>
                  <div style={styles.settingCard}>
                    <Field label="Draw date">
                      <input
                        name="draw_at"
                        type="datetime-local"
                        defaultValue={formatDateTimeLocal(
                          raffle.draw_at,
                        )}
                        style={styles.input}
                      />
                    </Field>
                  </div>

                  <div style={styles.settingCard}>
                    <Field label="Status">
                      <select
                        name="status"
                        defaultValue={raffle.status}
                        style={styles.input}
                      >
                        <option value="draft">Draft</option>
                        <option value="published">
                          Published
                        </option>
                        <option value="closed">Closed</option>
                        <option value="drawn">Drawn</option>
                      </select>
                    </Field>
                  </div>

                  <div style={styles.settingCard}>
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
                </div>
              </section>

              <section style={styles.innerPanel}>
                <div style={styles.innerHeader}>
                  <div>
                    <div style={styles.innerEyebrow}>
                      Ticket setup
                    </div>

                    <h3 style={styles.subTitle}>
                      Pricing & bundles
                    </h3>

                    <p style={styles.sectionDescription}>
                      Configure pricing, number range,
                      colours and bundle offers.
                    </p>
                  </div>
                </div>

                <div style={styles.threeColumn}>
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
                      defaultValue={
                        config.startNumber ?? 1
                      }
                      style={styles.input}
                    />
                  </Field>

                  <Field label="End number">
                    <input
                      name="endNumber"
                      type="number"
                      defaultValue={
                        config.endNumber ??
                        raffle.total_tickets
                      }
                      style={styles.input}
                    />
                  </Field>
                </div>

                <div style={styles.colourGrid}>
                  {PRESET_COLOURS.map((colour) => {
                    const selected =
                      colours.includes(colour);

                    const swatch =
                      COLOUR_SWATCHES[colour] ||
                      "#e2e8f0";

                    return (
                      <label
                        key={colour}
                        style={{
                          ...styles.colourCard,
                          borderColor: selected
                            ? "#1683f8"
                            : "#e2e8f0",
                          background: selected
                            ? "#eff6ff"
                            : "#ffffff",
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
                              colour === "White"
                                ? "#cbd5e1"
                                : "transparent",
                          }}
                        />

                        <span style={styles.colourText}>
                          <strong>{colour}</strong>

                          <small>
                            {soldByColour[colour] || 0} sold
                          </small>
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
                        (colour: string) =>
                          !PRESET_COLOURS.includes(
                            colour,
                          ),
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

                      <div style={styles.offerInputs}>
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

                <div style={styles.twoColumn}>
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

                <div style={styles.settingsGrid}>
                  <div style={styles.settingCard}>
                    <Field label="Auto draw from prize number">
                      <input
                        name="auto_draw_from_prize"
                        type="number"
                        min={1}
                        defaultValue={autoDrawFromPrize}
                        style={styles.input}
                      />
                    </Field>
                  </div>

                  <div style={styles.settingCard}>
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
          <summary style={styles.adminSummary}>
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
          <summary style={styles.adminSummary}>
            <div>
              <div style={styles.sectionEyebrow}>Section 3</div>

              <h2 style={styles.sectionTitle}>Draw centre</h2>

              <p style={styles.sectionDescription}>
                View winners, add postal tickets, run automatic draws and open
                the dramatic live draw.
              </p>
            </div>

            <div style={styles.summaryPillRow}>
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
                <div style={styles.twoColumn}>
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

                <div style={styles.twoColumn}>
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

              <div style={styles.drawGrid}>
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

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
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

function StatusMiniPill({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
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
  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 16,
    alignItems: "stretch",
  },
  settingCard: {
    display: "grid",
    alignContent: "start",
    minWidth: 0,
    padding: 18,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #dbe3ef",
    boxShadow: "0 2px 10px rgba(15,23,42,0.03)",
  },
  mediaPanel: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 0.9fr)",
    gap: 16,
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #dbe3ef",
    minWidth: 0,
  },
  mediaPanelLeft: {
    minWidth: 0,
  },
  mediaHeader: {
    marginBottom: 12,
  },
  mediaEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },
  mediaTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    letterSpacing: "-0.025em",
  },
  mediaDescription: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
  },
  mediaPreview: {
    minHeight: 220,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #dbe3ef",
    overflow: "hidden",
  },
};
