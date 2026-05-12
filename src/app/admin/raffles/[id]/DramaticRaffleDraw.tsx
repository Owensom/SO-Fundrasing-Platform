import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { getRaffleById } from "@/lib/raffles";
import { query } from "@/lib/db";
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
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function formatDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 16);
}

function formatDrawDate(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

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

function getStatusStyle(status: string): React.CSSProperties {
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
  if (!quantity || !price || !singleTicketPriceCents) return "Bundle row";

  const normalPrice = (Number(singleTicketPriceCents) / 100) * Number(quantity);
  const offerPrice = Number(price);
  const saving = normalPrice - offerPrice;

  if (!Number.isFinite(saving) || saving <= 0) return "No saving";

  return `Save ${saving.toFixed(2)}`;
}
export default async function AdminRafflePage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

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

  const remainingTickets = Math.max(
    totalTickets - soldTicketsCount,
    0,
  );

  const progress = getProgressPercent(
    soldTicketsCount,
    totalTickets,
  );

  const statusStyle = getStatusStyle(raffle.status);

  return (
    <main style={styles.page}>
      <section style={styles.topBar}>
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

      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>
            Raffle editor
          </div>

          <div style={styles.heroTitleRow}>
            <h1 style={styles.heroTitle}>
              {raffle.title}
            </h1>

            <div
              style={{
                ...styles.statusPill,
                ...statusStyle,
              }}
            >
              {raffle.status}
            </div>
          </div>

          <p style={styles.heroSlug}>
            /r/{raffle.slug}
          </p>

          {raffle.description ? (
            <p style={styles.heroDescription}>
              {raffle.description}
            </p>
          ) : (
            <p style={styles.heroDescriptionMuted}>
              No description added yet.
            </p>
          )}
        </div>

        <div style={styles.heroImageWrap}>
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

      <section style={styles.summaryGrid}>
        <SummaryCard
          label="Ticket price"
          value={formatMoney(
            raffle.ticket_price_cents,
            raffle.currency,
          )}
        />

        <SummaryCard
          label="Draw date"
          value={formatDrawDate(raffle.draw_at)}
        />

        <SummaryCard
          label="Total tickets"
          value={totalTickets}
        />

        <SummaryCard
          label="Sold"
          value={soldTicketsCount}
        />

        <SummaryCard
          label="Remaining"
          value={remainingTickets}
        />
      </section>

      <section style={styles.progressCard}>
        <div style={styles.progressHeader}>
          <div>
            <strong style={{ color: "#0f172a" }}>
              Sales progress
            </strong>

            <div style={styles.mutedSmall}>
              {soldTicketsCount} sold from {totalTickets} tickets
            </div>
          </div>

          <div style={styles.progressPercent}>
            {progress}%
          </div>
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
          <h2 style={styles.sectionTitle}>
            Raffle actions
          </h2>

          <p style={styles.sectionDescription}>
            Publish, close, draw or remove this raffle
            using the existing action controls.
          </p>
        </div>

        <RaffleAdminActions
          raffleId={raffle.id}
          status={raffle.status}
        />
      </section>
            <section style={styles.section}>
        <details open style={styles.adminDetails}>
          <summary style={styles.adminSummary}>
            <div>
              <h2 style={styles.sectionTitle}>Edit raffle</h2>
              <p style={styles.sectionDescription}>
                Update the public details, pricing, colours and offer bundles.
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
              <input type="hidden" name="image_position" value={imagePosition} />

              <div style={styles.twoColumn}>
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

              <div style={styles.mediaBox}>
                <div>
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
                  />
                </div>

                <div style={styles.previewBox}>
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

              <Field label="Draw date">
                <input
                  name="draw_at"
                  type="datetime-local"
                  defaultValue={formatDateTimeLocal(raffle.draw_at)}
                  style={styles.input}
                />
              </Field>

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
              </div>

              <div style={styles.twoColumn}>
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

              <section style={styles.innerPanel}>
                <div style={styles.innerHeader}>
                  <div>
                    <h3 style={styles.subTitle}>Entry question (legal)</h3>
                    <p style={styles.sectionDescription}>
                      Add a skill-based question for the public checkout flow.
                    </p>
                  </div>
                </div>

                <div style={styles.twoColumn}>
                  <Field label="Question">
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

                <p style={styles.helpText}>
                  The public raffle page requires this answer before checkout
                  when a question is set.
                </p>
              </section>

              <section style={styles.innerPanel}>
                <div style={styles.innerHeader}>
                  <div>
                    <h3 style={styles.subTitle}>Free postal entry</h3>
                    <p style={styles.sectionDescription}>
                      Add the postal entry route shown on the public raffle page.
                    </p>
                  </div>
                </div>

                <Field label="Postal address">
                  <textarea
                    name="free_entry_address"
                    rows={3}
                    defaultValue={String(config.free_entry?.address ?? "")}
                    placeholder="e.g. SO Foundation, 123 High Street, London, SW1A 1AA"
                    style={styles.textarea}
                  />
                </Field>

                <Field label="Postal instructions">
                  <textarea
                    name="free_entry_instructions"
                    rows={4}
                    defaultValue={String(
                      config.free_entry?.instructions ?? "",
                    )}
                    placeholder="Include your full name, email address, phone number, raffle name, answer to the entry question and preferred ticket number/colour if applicable."
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
                  be contacted if they win and included in the automatic or
                  dramatic draw. One entry per postcard/envelope.
                </p>
              </section>

              <section style={styles.innerPanel}>
                <div style={styles.innerHeader}>
                  <div>
                    <h3 style={styles.subTitle}>Ticket colours</h3>
                    <p style={styles.sectionDescription}>
                      Preset colours plus optional custom colours.
                    </p>
                  </div>
                </div>

                <div style={styles.colourGrid}>
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
                      .filter((colour: string) => !PRESET_COLOURS.includes(colour))
                      .join(", ")}
                    style={styles.input}
                  />
                </Field>
              </section>

              <section style={styles.innerPanel}>
                <div style={styles.innerHeader}>
                  <div>
                    <h3 style={styles.subTitle}>Offers</h3>
                    <p style={styles.sectionDescription}>
                      Optional bundle pricing. Example: 3 tickets for 12.00.
                    </p>
                  </div>
                </div>

                <input type="hidden" name="offer_count" value={offerRows.length} />

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

                <p style={styles.helpText}>
                  Leave unused rows blank. Save the raffle to apply changes.
                </p>
              </section>

              <section style={styles.innerPanel}>
                <div style={styles.innerHeader}>
                  <div>
                    <h3 style={styles.subTitle}>Auto draw range</h3>
                    <p style={styles.sectionDescription}>
                      Choose which prize numbers the randomizer should draw.
                    </p>
                  </div>
                </div>

                <div style={styles.twoColumn}>
                  <Field label="Auto draw from prize number">
                    <input
                      name="auto_draw_from_prize"
                      type="number"
                      min={1}
                      defaultValue={autoDrawFromPrize}
                      placeholder="6"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Auto draw to prize number">
                    <input
                      name="auto_draw_to_prize"
                      type="number"
                      min={1}
                      defaultValue={autoDrawToPrize}
                      placeholder="999"
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
          open={!Array.isArray(config.prizes) || config.prizes.length === 0}
          style={styles.adminDetails}
        >
          <summary style={styles.adminSummary}>
            <div>
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
              <h2 style={styles.sectionTitle}>Draw centre</h2>
              <p style={styles.sectionDescription}>
                View winners, add postal tickets, auto draw remaining prizes and
                open the dramatic live draw.
              </p>
            </div>

            <span style={styles.adminSummaryToggle}>Open / close</span>
          </summary>

          <div style={styles.adminDetailsBody}>
            {winners.length ? (
              <div style={styles.winnerList}>
                {winners.map((winner) => (
                  <div key={winner.id} style={styles.winnerCard}>
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

            <form
              action={`/api/admin/raffles/${raffle.id}/manual-ticket`}
              method="post"
              style={{ ...styles.drawPanel, marginBottom: 14 }}
            >
              <h3 style={styles.subTitle}>Add manual postal ticket</h3>

              <p style={styles.sectionDescription}>
                Add a received postal entry as a normal ticket in the draw. This
                ticket will be included in the automatic draw and dramatic live
                draw.
              </p>

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
          </div>
        </details>
      </section>
    </main>
  );
}
