import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import {
  getSquaresGameById,
  listSquaresSales,
  listSquaresWinners,
} from "../../../../../api/_lib/squares-repo";
import ImageFocusUploadField from "@/components/ImageFocusUploadField";
import SquaresPrizeSettings from "./SquaresPrizeSettings";
import DramaticSquaresDraw from "./DramaticSquaresDraw";

const DEFAULT_SQUARES_IMAGE = "/brand/so-default-squares.png";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: {
    id: string;
  };
};

type Prize = {
  title?: string;
  name?: string;
  description?: string;
};

type SoldSquareOption = {
  squareNumber: number;
  customerName: string;
  customerEmail: string;
};

function firstNameOnly(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || "Winner";
}

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function formatMoney(cents: number | null | undefined, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(Number(cents || 0) / 100);
  } catch {
    return `${moneyFromCents(cents)} ${currency || "GBP"}`;
  }
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

function getProgressPercent(sold: number, total: number) {
  if (!total || total <= 0) return 0;

  return Math.min(100, Math.max(0, Math.round((sold / total) * 100)));
}

function statusStyle(status: string): CSSProperties {
  if (status === "published") {
    return {
      background: "#dcfce7",
      color: "#166534",
      borderColor: "#bbf7d0",
    };
  }

  if (status === "drawn") {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
      borderColor: "#bfdbfe",
    };
  }

  if (status === "closed") {
    return {
      background: "#fff7ed",
      color: "#9a3412",
      borderColor: "#fed7aa",
    };
  }

  return {
    background: "#f1f5f9",
    color: "#475569",
    borderColor: "#e2e8f0",
  };
}

function isConfigured(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

async function safeListSquaresWinners(gameId: string) {
  try {
    return await listSquaresWinners(gameId);
  } catch (error) {
    console.error("Admin squares winners failed:", error);
    return [];
  }
}

async function safeListSquaresSales(gameId: string) {
  try {
    return await listSquaresSales(gameId);
  } catch (error) {
    console.error("Admin squares sales failed:", error);
    return [];
  }
}

export default async function AdminSquaresEditPage({ params }: PageProps) {
  const tenantSlug = await getTenantSlugFromHeaders();
  const game = await getSquaresGameById(params.id);

  if (!tenantSlug || !game || game.tenant_slug !== tenantSlug) {
    notFound();
  }

  const [winners, sales] = await Promise.all([
    safeListSquaresWinners(game.id),
    safeListSquaresSales(game.id),
  ]);

  const currency = game.currency || "GBP";
  const config = (game.config_json ?? {}) as any;
  const question = config.question ?? {};
  const freeEntry = config.free_entry ?? {};
  const hasCustomImage = Boolean(game.image_url);

  const imageFocusX = Number(config.image_focus_x ?? 50);
  const imageFocusY = Number(config.image_focus_y ?? 50);
  const imageObjectPosition = `${imageFocusX}% ${imageFocusY}%`;

  const savedPrizes = Array.isArray(config.prizes)
    ? (config.prizes as Prize[])
    : [];

  const soldSquareOptions: SoldSquareOption[] = sales
    .flatMap((sale: any) =>
      Array.isArray(sale.squares)
        ? sale.squares.map((squareNumber: number | string) => ({
            squareNumber: Number(squareNumber),
            customerName: String(sale.customer_name || "Supporter"),
            customerEmail: String(sale.customer_email || ""),
          }))
        : [],
    )
    .filter(
      (entry) =>
        Number.isInteger(entry.squareNumber) &&
        entry.squareNumber >= 1 &&
        entry.squareNumber <= Number(game.total_squares || 0),
    )
    .sort((a, b) => a.squareNumber - b.squareNumber);

  const drawnPrizeNumbers = winners
    .map((winner: any) => Number(winner.prize_number))
    .filter((number) => Number.isFinite(number) && number > 0);

  const drawnSquareNumbers = winners
    .map((winner: any) => Number(winner.square_number))
    .filter((number) => Number.isFinite(number) && number > 0);

  const soldSquares = soldSquareOptions.length;
  const totalSquares = Number(game.total_squares || 0);
  const remainingSquares = Math.max(totalSquares - soldSquares, 0);
  const progress = getProgressPercent(soldSquares, totalSquares);

  const legalQuestionEnabled =
    isConfigured(question.text) && isConfigured(question.answer);

  const postalEntryEnabled =
    isConfigured(freeEntry.address) || isConfigured(freeEntry.instructions);

  const prizesConfigured = savedPrizes.length > 0;

  return (
    <main style={styles.page}>
      <section style={styles.topBar}>
        <Link href="/admin/squares" style={styles.backLink}>
          ← Back to squares
        </Link>

        <Link href={`/s/${game.slug}`} target="_blank" style={styles.publicLink}>
          View campaign page
        </Link>
      </section>

      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Squares editor</div>

          <div style={styles.heroTitleRow}>
            <h1 className="so-brand-heading" style={styles.heroTitle}>
              {game.title}
            </h1>

            <span style={{ ...styles.statusPill, ...statusStyle(game.status) }}>
              {game.status}
            </span>
          </div>

          <p style={styles.heroSlug}>/s/{game.slug}</p>

          {game.description ? (
            <p style={styles.heroDescription}>{game.description}</p>
          ) : (
            <p style={styles.heroDescriptionMuted}>No description added yet.</p>
          )}

          <div style={styles.heroMetaGrid}>
            <HeroMeta label="Draw" value={formatDrawDate(game.draw_at)} />
            <HeroMeta
              label="Squares sold"
              value={`${soldSquares}/${totalSquares}`}
            />
            <HeroMeta label="Progress" value={`${progress}% sold`} />
          </div>
        </div>

        <div style={styles.heroImageWrap}>
          <img
            src={game.image_url || DEFAULT_SQUARES_IMAGE}
            alt={game.title || "SO Squares"}
            style={{
              ...styles.heroImage,
              objectFit: hasCustomImage ? "cover" : "contain",
              objectPosition: hasCustomImage ? imageObjectPosition : "center",
              padding: hasCustomImage ? 0 : 28,
              background: hasCustomImage
                ? "#1e293b"
                : "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
              boxSizing: "border-box",
            }}
          />
        </div>
      </section>

      <section style={styles.summaryGrid}>
        <SummaryCard
          label="Price"
          value={formatMoney(game.price_per_square_cents, currency)}
        />

        <SummaryCard label="Draw date" value={formatDrawDate(game.draw_at)} />

        <SummaryCard label="Total squares" value={totalSquares} />

        <SummaryCard label="Sold" value={soldSquares} />

        <SummaryCard label="Remaining" value={remainingSquares} />
      </section>

      <section style={styles.progressCard}>
        <div style={styles.progressHeader}>
          <div>
            <strong style={{ color: "#0f172a" }}>Sales progress</strong>

            <div style={styles.mutedSmall}>
              {soldSquares} sold from {totalSquares} squares
            </div>
          </div>

          <div style={styles.progressPercent}>{progress}%</div>
        </div>

        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>
      </section>

      <form
        action={`/api/admin/squares/${game.id}`}
        method="post"
        style={styles.form}
      >
        <section style={styles.section}>
          <details open style={styles.adminDetails}>
            <summary style={styles.adminSummary}>
              <div>
                <div style={styles.sectionEyebrow}>Section 1</div>

                <h2 className="so-brand-card-title" style={styles.sectionTitle}>
                  Edit squares game
                </h2>

                <p style={styles.sectionDescription}>
                  Update the public details, image, pricing and draw settings.
                </p>
              </div>

              <div style={styles.summaryPillRow}>
                <StatusMiniPill label="Legal" active={legalQuestionEnabled} />
                <StatusMiniPill label="Postal" active={postalEntryEnabled} />
                <span style={styles.adminSummaryToggle}>Open / close</span>
              </div>
            </summary>

            <div style={styles.adminDetailsBody}>
              <section style={styles.innerPanel}>
                <div style={styles.innerHeader}>
                  <div>
                    <div style={styles.innerEyebrow}>Public overview</div>

                    <h3 style={styles.subTitle}>Campaign details</h3>

                    <p style={styles.sectionDescription}>
                      These details are shown on the public squares page.
                    </p>
                  </div>
                </div>

                <div style={styles.twoColumnNoMargin}>
                  <Field label="Title">
                    <input
                      name="title"
                      defaultValue={game.title}
                      required
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Slug">
                    <input
                      name="slug"
                      defaultValue={game.slug}
                      required
                      style={styles.input}
                    />
                  </Field>
                </div>

                <Field label="Description">
                  <textarea
                    name="description"
                    rows={4}
                    defaultValue={game.description ?? ""}
                    style={styles.textarea}
                  />
                </Field>

                <div style={styles.mediaBox}>
                  <div style={styles.mediaControls}>
                    <h3 style={styles.subTitle}>Squares image</h3>

                    <p style={styles.sectionDescription}>
                      Upload or replace the public image for this squares game.
                    </p>

                    <ImageFocusUploadField
                      currentImageUrl={game.image_url || ""}
                      currentFocusX={imageFocusX}
                      currentFocusY={imageFocusY}
                      label="Squares image"
                      previewAlt={game.title}
                    />
                  </div>

                  <div style={styles.previewBox}>
                    <img
                      src={game.image_url || DEFAULT_SQUARES_IMAGE}
                      alt={game.title || "SO Squares"}
                      style={{
                        ...styles.previewImage,
                        objectFit: hasCustomImage ? "cover" : "contain",
                        objectPosition: hasCustomImage
                          ? imageObjectPosition
                          : "center",
                        padding: hasCustomImage ? 0 : 22,
                        background: hasCustomImage
                          ? "#ffffff"
                          : "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              </section>
                            <section style={styles.innerPanel}>
                <div style={styles.innerHeader}>
                  <div>
                    <div style={styles.innerEyebrow}>Squares setup</div>

                    <h3 style={styles.subTitle}>Board, pricing & status</h3>

                    <p style={styles.sectionDescription}>
                      Configure board size, pricing, draw date and status.
                    </p>
                  </div>
                </div>

                <div style={styles.threeColumn}>
                  <Field label="Draw date">
                    <input
                      name="draw_at"
                      type="datetime-local"
                      defaultValue={formatDateTimeLocal(game.draw_at)}
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Total squares">
                    <input
                      name="total_squares"
                      type="number"
                      min={1}
                      max={500}
                      defaultValue={game.total_squares}
                      required
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Price per square">
                    <input
                      name="price_per_square"
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={moneyFromCents(game.price_per_square_cents)}
                      required
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Currency">
                    <select
                      name="currency"
                      defaultValue={currency}
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
                      defaultValue={game.status}
                      style={styles.input}
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="closed">Closed</option>
                      <option value="drawn">Drawn</option>
                    </select>
                  </Field>
                </div>
              </section>

              <section style={styles.innerPanel}>
                <div style={styles.innerHeader}>
                  <div>
                    <div style={styles.innerEyebrow}>Compliance</div>

                    <h3 style={styles.subTitle}>Legal & postal entry</h3>

                    <p style={styles.sectionDescription}>
                      Add a skill-based question and the free postal entry route
                      shown on the public squares page.
                    </p>
                  </div>
                </div>

                <div style={styles.twoColumnNoMargin}>
                  <Field label="Entry question">
                    <input
                      name="question_text"
                      defaultValue={String(question.text ?? "")}
                      placeholder="e.g. What colour is a London taxi?"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Correct answer">
                    <input
                      name="question_answer"
                      defaultValue={String(question.answer ?? "")}
                      placeholder="e.g. black"
                      style={styles.input}
                    />
                  </Field>
                </div>

                <Field label="Postal address">
                  <textarea
                    name="free_entry_address"
                    rows={3}
                    defaultValue={String(freeEntry.address ?? "")}
                    placeholder="e.g. SO Foundation, 123 High Street, London, SW1A 1AA"
                    style={styles.textarea}
                  />
                </Field>

                <Field label="Postal instructions">
                  <textarea
                    name="free_entry_instructions"
                    rows={4}
                    defaultValue={String(freeEntry.instructions ?? "")}
                    placeholder="Include your full name, email address, phone number, squares game name, answer to the entry question and preferred square number if applicable."
                    style={styles.textarea}
                  />
                </Field>

                <Field label="Postal entry closing date">
                  <input
                    name="free_entry_closes_at"
                    type="datetime-local"
                    defaultValue={formatDateTimeLocal(freeEntry.closes_at)}
                    style={styles.input}
                  />
                </Field>

                <p style={styles.helpText}>
                  Postal entries should include an email address so the entrant
                  can be contacted if they win and included in the automatic or
                  dramatic draw.
                </p>
              </section>

              <section style={styles.innerPanel}>
                <div style={styles.innerHeader}>
                  <div>
                    <div style={styles.innerEyebrow}>Draw system</div>

                    <h3 style={styles.subTitle}>Auto draw range</h3>

                    <p style={styles.sectionDescription}>
                      Choose which prize numbers the randomizer should draw.
                      Example: set from 6 to 999 to keep the top 5 prizes for a
                      live draw.
                    </p>
                  </div>
                </div>

                <div style={styles.twoColumnNoMargin}>
                  <Field label="Auto draw from prize number">
                    <input
                      name="auto_draw_from_prize"
                      type="number"
                      min={1}
                      defaultValue={Number(config.auto_draw_from_prize || 1)}
                      placeholder="6"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Auto draw to prize number">
                    <input
                      name="auto_draw_to_prize"
                      type="number"
                      min={1}
                      defaultValue={Number(config.auto_draw_to_prize || 999)}
                      placeholder="999"
                      style={styles.input}
                    />
                  </Field>
                </div>
              </section>

              <section style={styles.submitBarInner}>
                <div>
                  <strong style={{ color: "#0f172a" }}>Save changes</strong>

                  <div style={styles.mutedSmall}>
                    This updates the public squares page and admin values.
                  </div>
                </div>

                <button type="submit" style={styles.submitButton}>
                  Save squares
                </button>
              </section>
            </div>
          </details>
        </section>

        <section style={styles.section}>
          <details open={!prizesConfigured} style={styles.adminDetails}>
            <summary style={styles.adminSummary}>
              <div>
                <div style={styles.sectionEyebrow}>Section 2</div>

                <h2 className="so-brand-card-title" style={styles.sectionTitle}>
                  Prize management
                </h2>

                <p style={styles.sectionDescription}>
                  Manage prize names, descriptions and public visibility.
                </p>
              </div>

              <span style={styles.adminSummaryToggle}>Open / close</span>
            </summary>

            <div style={styles.adminDetailsBody}>
              <SquaresPrizeSettings initialPrizes={savedPrizes} />
            </div>
          </details>
        </section>

        <section style={styles.submitBar}>
          <div>
            <strong style={{ color: "#0f172a" }}>
              Save all squares settings
            </strong>

            <div style={styles.mutedSmall}>
              Use this after changing details, legal settings, prizes or draw
              ranges.
            </div>
          </div>

          <button type="submit" style={styles.submitButton}>
            Save squares
          </button>
        </section>
      </form>

      <section style={styles.section}>
        <details style={styles.adminDetails}>
          <summary style={styles.adminSummary}>
            <div>
              <div style={styles.sectionEyebrow}>Section 3</div>

              <h2 className="so-brand-card-title" style={styles.sectionTitle}>
                Draw centre
              </h2>

              <p style={styles.sectionDescription}>
                View winners, auto draw remaining prizes, or open the dramatic
                live draw.
              </p>
            </div>

            <div style={styles.summaryPillRow}>
              <span style={styles.neutralPill}>{winners.length} winners</span>

              <span style={styles.neutralPill}>
                {soldSquareOptions.length} eligible squares
              </span>

              <span style={styles.adminSummaryToggle}>Open / close</span>
            </div>
          </summary>

          <div style={styles.adminDetailsBody}>
            {winners.length ? (
              <div style={styles.winnerList}>
                {winners.map((winner: any) => (
                  <div key={winner.id} style={styles.winnerCard}>
                    <div style={styles.winnerPrizeIcon}>
                      {winner.prize_number}
                    </div>

                    <div>
                      <div style={styles.winnerLabel}>Prize</div>

                      <div style={styles.winnerValue}>
                        {winner.prize_title}
                      </div>
                    </div>

                    <div>
                      <div style={styles.winnerLabel}>Square</div>

                      <div style={styles.winnerValue}>
                        #{winner.square_number}
                      </div>
                    </div>

                    <div>
                      <div style={styles.winnerLabel}>Winner</div>

                      <div style={styles.winnerValue}>
                        {firstNameOnly(winner.customer_name)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.noWinnersBox}>
                No winners have been drawn yet.
              </div>
            )}

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
                  action={`/api/admin/squares/${game.id}/draw/auto`}
                  method="post"
                  style={styles.drawPanel}
                >
                  <h3 style={styles.subTitle}>Automatic random draw</h3>

                  <p style={styles.sectionDescription}>
                    Randomly draw remaining undrawn prizes using the saved auto
                    draw range.
                  </p>

                  <button type="submit" style={styles.drawButton}>
                    Auto draw remaining winners
                  </button>
                </form>

                <DramaticSquaresDraw
                  gameId={game.id}
                  soldSquareOptions={soldSquareOptions}
                  drawnPrizeNumbers={drawnPrizeNumbers}
                  drawnSquareNumbers={drawnSquareNumbers}
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
  form: {
    display: "grid",
    gap: 0,
    minWidth: 0,
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
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
    gap: 12,
    marginBottom: 12,
  },
  twoColumnNoMargin: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
    gap: 12,
  },
  threeColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
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
  previewImage: {
    width: "100%",
    height: "100%",
    display: "block",
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
    marginBottom: 16,
  },
  submitBarInner: {
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
    minHeight: 44,
  },
  mutedSmall: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 3,
  },
  helpText: {
    color: "#64748b",
    fontSize: 13,
    margin: 0,
    overflowWrap: "anywhere",
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
  noWinnersBox: {
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
