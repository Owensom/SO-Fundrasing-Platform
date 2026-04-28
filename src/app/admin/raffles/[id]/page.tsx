import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { getRaffleById } from "@/lib/raffles";
import { query } from "@/lib/db";
import RaffleAdminActions from "./RaffleAdminActions";
import PrizeSettings from "./PrizeSettings";
import ImageUploadField from "@/components/ImageUploadField";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type WinnerRow = {
  id: string;
  raffle_id: string;
  prize_position: number;
  ticket_number: number;
  colour: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
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

  const soldTickets = Number(raffle.sold_tickets || 0);
  const totalTickets = Number(raffle.total_tickets || 0);
  const remainingTickets = Math.max(totalTickets - soldTickets, 0);
  const progress = getProgressPercent(soldTickets, totalTickets);
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

            <div
              style={{
                ...styles.statusPill,
                ...statusStyle,
              }}
            >
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
        <SummaryCard label="Sold" value={soldTickets} />
        <SummaryCard label="Remaining" value={remainingTickets} />
      </section>

      <section style={styles.progressCard}>
        <div style={styles.progressHeader}>
          <div>
            <strong style={{ color: "#0f172a" }}>Sales progress</strong>
            <div style={styles.mutedSmall}>
              {soldTickets} sold from {totalTickets} tickets
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
            Publish, close, draw or remove this raffle using the existing action controls.
          </p>
        </div>

        <RaffleAdminActions raffleId={raffle.id} status={raffle.status} />
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Edit raffle</h2>
            <p style={styles.sectionDescription}>
              Update the public details, pricing, colours and offer bundles.
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

          <div style={styles.mediaBox}>
            <div>
              <h3 style={styles.subTitle}>Raffle image</h3>
              <p style={styles.sectionDescription}>
                Upload or replace the public image, then choose the focus position.
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
              <select name="image_position" defaultValue={imagePosition} style={styles.input}>
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
              <select name="status" defaultValue={raffle.status} style={styles.input}>
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
                    background: colours.includes(colour) ? "#1683f8" : "#e2e8f0",
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
                <div key={`${offer.id}-${index}`} style={styles.offerRow}>
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
              ))}
            </div>

            <p style={styles.helpText}>
              Leave unused rows blank. Save the raffle to apply changes.
            </p>
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
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Prize settings</h2>
            <p style={styles.sectionDescription}>
              Manage prize names, descriptions and public visibility.
            </p>
          </div>
        </div>

        <PrizeSettings raffleId={raffle.id} initialPrizes={config.prizes ?? []} />
      </section>

      {raffle.status === "drawn" && (
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Winners</h2>
              <p style={styles.sectionDescription}>
                Winning ticket results for this raffle.
              </p>
            </div>
          </div>

          {winners.length ? (
            <div style={styles.winnerList}>
              {winners.map((winner) => (
                <div key={winner.id} style={styles.winnerCard}>
                  <div>
                    <div style={styles.winnerLabel}>Prize</div>
                    <div style={styles.winnerValue}>{winner.prize_position}</div>
                  </div>

                  <div>
                    <div style={styles.winnerLabel}>Ticket</div>
                    <div style={styles.winnerValue}>#{winner.ticket_number}</div>
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
                      {winner.buyer_name || "—"}
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
        </section>
      )}
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "28px 16px 56px",
    background: "#f8fafc",
    minHeight: "100vh",
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
    color: "#334155",
    textDecoration: "none",
    fontWeight: 800,
  },
  publicLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 260px",
    gap: 18,
    alignItems: "stretch",
    padding: 22,
    borderRadius: 24,
    background: "#0f172a",
    color: "#ffffff",
    marginBottom: 16,
  },
  heroContent: {
    minWidth: 0,
  },
  eyebrow: {
    display: "inline-flex",
    padding: "5px 9px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    fontSize: 12,
    fontWeight: 900,
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
  },
  heroTitle: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.08,
    letterSpacing: "-0.04em",
    wordBreak: "break-word",
  },
  statusPill: {
    padding: "7px 11px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 13,
    textTransform: "capitalize",
    fontWeight: 900,
  },
  heroSlug: {
    margin: "8px 0 0",
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: 700,
    wordBreak: "break-word",
  },
  heroDescription: {
    margin: "12px 0 0",
    color: "#e2e8f0",
    lineHeight: 1.55,
    maxWidth: 720,
  },
  heroDescriptionMuted: {
    margin: "12px 0 0",
    color: "#94a3b8",
    lineHeight: 1.55,
  },
  heroImageWrap: {
    borderRadius: 18,
    background: "#1e293b",
    border: "1px solid rgba(255,255,255,0.12)",
    overflow: "hidden",
    minHeight: 180,
  },
  heroImageEmpty: {
    height: "100%",
    minHeight: 180,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 46,
    color: "#94a3b8",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    padding: 15,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
  },
  summaryValue: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 900,
    marginTop: 5,
    wordBreak: "break-word",
  },
  progressCard: {
    padding: 16,
    borderRadius: 20,
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
  },
  progressPercent: {
    color: "#166534",
    fontWeight: 900,
    fontSize: 18,
  },
  progressTrack: {
    height: 10,
    background: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "#16a34a",
    borderRadius: 999,
  },
  actionsCard: {
    display: "grid",
    gap: 14,
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 16,
  },
  section: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 16,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    letterSpacing: "-0.02em",
  },
  sectionDescription: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
  },
  form: {
    display: "grid",
    gap: 14,
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },
  threeColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 12,
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
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    resize: "vertical",
    boxSizing: "border-box",
  },
  mediaBox: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.5fr) minmax(180px, 260px)",
    gap: 16,
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
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
  emptyPreview: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
    fontSize: 42,
  },
  innerPanel: {
    display: "grid",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  innerHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  colourGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  colourPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "10px 14px",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 900,
  },
  offerList: {
    display: "grid",
    gap: 10,
  },
  offerRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto",
    gap: 10,
    alignItems: "end",
    padding: 12,
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    background: "#ffffff",
  },
  checkboxLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    fontWeight: 900,
    color: "#334155",
    cursor: "pointer",
  },
  helpText: {
    color: "#64748b",
    fontSize: 13,
    margin: 0,
  },
  submitBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: 16,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  submitButton: {
    padding: "13px 20px",
    border: "none",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(22,131,248,0.22)",
  },
  mutedSmall: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 3,
  },
  winnerList: {
    display: "grid",
    gap: 10,
  },
  winnerCard: {
    display: "grid",
    gridTemplateColumns: "90px 110px 150px minmax(0, 1fr)",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    alignItems: "start",
  },
  winnerLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 4,
  },
  winnerValue: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 900,
    wordBreak: "break-word",
  },
  winnerEmail: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 3,
    wordBreak: "break-word",
  },
  emptyBox: {
    padding: 16,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#64748b",
    fontWeight: 700,
  },
};
