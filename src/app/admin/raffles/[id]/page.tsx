import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { getRaffleById } from "@/lib/raffles";
import { query } from "@/lib/db";
import RaffleAdminActions from "./RaffleAdminActions";
import PrizeSettings from "./PrizeSettings";
import ImageUploadField from "@/components/ImageUploadField";
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

const IMAGE_POSITIONS = [
  { value: "center", label: "Center" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

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

export default async function AdminRafflePage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const raffle = await getRaffleById(id);
  if (!raffle) notFound();

  const config = (raffle.config_json as any) ?? {};
  const imagePosition = normaliseImagePosition(config.image_position);

  const entryQuestionText = String(config.question?.text ?? "").trim();
  const entryQuestionAnswer = String(config.question?.answer ?? "").trim();

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

  const soldTickets = soldTicketRows
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
            <p style={styles.heroDescriptionMuted}>No description added yet.</p>
          )}
        </div>

        <div style={styles.heroImageWrap}>
          {raffle.image_url ? (
            <img
              src={raffle.image_url}
              alt={raffle.title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: imagePosition,
                display: "block",
              }}
            />
          ) : (
            <div style={styles.heroImageEmpty}>🎟️</div>
          )}
        </div>
      </section>

      <section style={styles.summaryGrid}>
        <SummaryCard
          label="Ticket price"
          value={formatMoney(raffle.ticket_price_cents, raffle.currency)}
        />
        <SummaryCard label="Draw date" value={formatDrawDate(raffle.draw_at)} />
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
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
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
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Edit raffle</h2>
            <p style={styles.sectionDescription}>
              Update the public details, pricing, colours, offer bundles and
              entry question.
            </p>
          </div>
        </div>

        <form
          action={`/api/admin/raffles/${raffle.id}`}
          method="post"
          style={styles.form}
        >
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

          <section style={styles.legalPanel}>
            <div>
              <h3 style={styles.subTitle}>Legal entry question</h3>
              <p style={styles.sectionDescription}>
                Add a campaign-specific question and correct answer. This is
                stored only on this raffle and helps make the entry a prize
                competition rather than a pure chance draw.
              </p>
            </div>

            <div style={styles.twoColumn}>
              <Field label="Entry question">
                <input
                  name="question_text"
                  defaultValue={entryQuestionText}
                  placeholder="Example: What colour is a traditional London taxi?"
                  style={styles.input}
                />
              </Field>

              <Field label="Correct answer">
                <input
                  name="question_answer"
                  defaultValue={entryQuestionAnswer}
                  placeholder="Example: black"
                  style={styles.input}
                />
              </Field>
            </div>

            <p style={styles.helpText}>
              Use a genuine knowledge or skill question relevant to the
              organiser or campaign. Avoid questions that are too trivial.
            </p>
          </section>

          <div style={styles.mediaBox}>
            <div>
              <h3 style={styles.subTitle}>Raffle image</h3>
              <p style={styles.sectionDescription}>
                Upload or replace the public image, then choose the focus
                position.
              </p>

              <ImageUploadField currentImageUrl={raffle.image_url ?? ""} />
            </div>

            <div style={styles.previewBox}>
              {raffle.image_url ? (
                <img
                  src={raffle.image_url}
                  alt={raffle.title}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: imagePosition,
                    display: "block",
                  }}
                />
              ) : (
                <div style={styles.emptyPreview}>🎟️</div>
              )}
            </div>
          </div>

          <div style={styles.twoColumn}>
            <Field label="Image focus">
              <select
                name="image_position"
                defaultValue={imagePosition}
                style={styles.input}
              >
                {IMAGE_POSITIONS.map((position) => (
                  <option key={position.value} value={position.value}>
                    {position.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Draw date">
              <input
                name="draw_at"
                type="datetime-local"
                defaultValue={formatDateTimeLocal(raffle.draw_at)}
                style={styles.input}
              />
            </Field>
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
                <h3 style={styles.subTitle}>Ticket colours</h3>
                <p style={styles.sectionDescription}>
                  Preset colour buttons plus optional custom colours.
                </p>
              </div>
            </div>

            <div style={styles.colourGrid}>
              {PRESET_COLOURS.map((colour) => (
                <label
                  key={colour}
                  style={{
                    ...styles.colourPill,
                    background: colours.includes(colour)
                      ? "#1683f8"
                      : "#e2e8f0",
                    color: colours.includes(colour) ? "#ffffff" : "#111827",
                  }}
                >
                  <input
                    type="checkbox"
                    name="colour_preset"
                    value={colour}
                    defaultChecked={colours.includes(colour)}
                    style={{ marginRight: 6 }}
                  />
                  {colour}
                </label>
              ))}
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
