import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import {
  getSquaresGameById,
  listSquaresWinners,
} from "../../../../../api/_lib/squares-repo";
import ImageUploadField from "@/components/ImageUploadField";

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

function firstNameOnly(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || "Winner";
}

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function formatMoney(cents: number | null | undefined, currency: string | null) {
  return `${moneyFromCents(cents)} ${currency || "GBP"}`;
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

export default async function AdminSquaresEditPage({ params }: PageProps) {
  const tenantSlug = await getTenantSlugFromHeaders();
  const game = await getSquaresGameById(params.id);

  if (!tenantSlug || !game || game.tenant_slug !== tenantSlug) {
    notFound();
  }

  const winners = await listSquaresWinners(game.id);

  const savedPrizes = Array.isArray(game.config_json?.prizes)
    ? (game.config_json.prizes as Prize[])
    : [];

  const prizeRows =
    savedPrizes.length > 0
      ? savedPrizes
      : [
          {
            title: "First prize",
            description: "",
          },
        ];

  const blankPrizeRows = Array.from({ length: 4 });

  const soldCount = Array.isArray(game.config_json?.sold)
    ? game.config_json.sold.length
    : 0;

  const reservedCount = Array.isArray(game.config_json?.reserved)
    ? game.config_json.reserved.length
    : 0;

  const totalSquares = Number(game.total_squares || 0);
  const remainingSquares = Math.max(totalSquares - soldCount - reservedCount, 0);
  const statusStyle = getStatusStyle(game.status);

  return (
    <main style={styles.page}>
      <section style={styles.topBar}>
        <Link href="/admin/squares" style={styles.backLink}>
          ← Back to squares
        </Link>

        <div style={styles.topActions}>
          <Link href="/admin/squares/new" style={styles.publicLink}>
            Create another
          </Link>

          <a
            href={`/s/${game.slug}`}
            target="_blank"
            rel="noreferrer"
            style={styles.publicLink}
          >
            View campaign page
          </a>
        </div>
      </section>

      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Squares editor</div>

          <div style={styles.heroTitleRow}>
            <h1 style={styles.heroTitle}>{game.title}</h1>

            <div
              style={{
                ...styles.statusPill,
                ...statusStyle,
              }}
            >
              {game.status}
            </div>
          </div>

          <p style={styles.heroSlug}>/s/{game.slug}</p>

          {game.description ? (
            <p style={styles.heroDescription}>{game.description}</p>
          ) : (
            <p style={styles.heroDescriptionMuted}>No description added yet.</p>
          )}
        </div>

        <div style={styles.heroImageWrap}>
          {game.image_url ? (
            <img
              src={game.image_url}
              alt={game.title}
              style={styles.heroImage}
            />
          ) : (
            <div style={styles.heroImageEmpty}>🔲</div>
          )}
        </div>
      </section>

      <section style={styles.summaryGrid}>
        <SummaryCard
          label="Price per square"
          value={formatMoney(game.price_per_square_cents, game.currency)}
        />
        <SummaryCard label="Draw date" value={formatDrawDate(game.draw_at)} />
        <SummaryCard label="Total squares" value={totalSquares} />
        <SummaryCard label="Sold" value={soldCount} />
        <SummaryCard label="Remaining" value={remainingSquares} />
      </section>

      <form action={`/api/admin/squares/${game.id}`} method="post" style={styles.form}>
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Edit squares game</h2>
              <p style={styles.sectionDescription}>
                Update the public details, image, pricing, draw date and prizes.
              </p>
            </div>

            <button type="submit" style={styles.submitButton}>
              Save changes
            </button>
          </div>

          <div style={styles.twoColumn}>
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
            <div>
              <h3 style={styles.subTitle}>Squares image</h3>
              <p style={styles.sectionDescription}>
                Upload or replace the public image for this squares game.
              </p>

              <ImageUploadField currentImageUrl={game.image_url ?? ""} />
            </div>

            <div style={styles.previewBox}>
              {game.image_url ? (
                <img
                  src={game.image_url}
                  alt={game.title}
                  style={styles.previewImage}
                />
              ) : (
                <div style={styles.emptyPreview}>🔲</div>
              )}
            </div>
          </div>

          <div style={styles.twoColumn}>
            <Field label="Draw date">
              <input
                name="draw_at"
                type="datetime-local"
                defaultValue={formatDateTimeLocal(game.draw_at)}
                style={styles.input}
              />
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

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Squares setup</h2>
              <p style={styles.sectionDescription}>
                Configure board size and pricing. Maximum board size is 500
                squares.
              </p>
            </div>
          </div>

          <div style={styles.threeColumn}>
            <Field label="Number of squares">
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
                defaultValue={game.currency ?? "GBP"}
                style={styles.input}
              >
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </Field>
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Prizes</h2>
              <p style={styles.sectionDescription}>
                Add one prize per row. Blank rows are ignored when saved.
              </p>
            </div>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeadRow}>
                  <th style={styles.th}>Prize</th>
                  <th style={styles.th}>Description</th>
                </tr>
              </thead>

              <tbody>
                {prizeRows.map((prize, index) => (
                  <tr key={`saved-${index}`} style={styles.tr}>
                    <td style={styles.td}>
                      <input
                        name="prize_title"
                        defaultValue={prize.title || prize.name || ""}
                        placeholder={`Prize ${index + 1}`}
                        style={styles.input}
                      />
                    </td>

                    <td style={styles.td}>
                      <input
                        name="prize_description"
                        defaultValue={prize.description || ""}
                        placeholder="Optional prize description"
                        style={styles.input}
                      />
                    </td>
                  </tr>
                ))}

                {blankPrizeRows.map((_, index) => (
                  <tr key={`blank-${index}`} style={styles.tr}>
                    <td style={styles.td}>
                      <input
                        name="prize_title"
                        placeholder={`Additional prize ${
                          prizeRows.length + index + 1
                        }`}
                        style={styles.input}
                      />
                    </td>

                    <td style={styles.td}>
                      <input
                        name="prize_description"
                        placeholder="Optional prize description"
                        style={styles.input}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={styles.submitBar}>
          <div>
            <strong style={{ color: "#0f172a" }}>Save squares game</strong>
            <div style={styles.mutedSmall}>
              This updates the live campaign page and admin values.
            </div>
          </div>

          <button type="submit" style={styles.submitButton}>
            Save squares game
          </button>
        </section>
      </form>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Draw winners</h2>
            <p style={styles.sectionDescription}>
              Randomly draw winners from paid squares for the configured prizes.
            </p>
          </div>
        </div>

        {winners.length > 0 ? (
          <div style={styles.winnerList}>
            {winners.map((winner) => (
              <div key={winner.id} style={styles.winnerCard}>
                <div>
                  <div style={styles.winnerLabel}>Prize</div>
                  <div style={styles.winnerValue}>{winner.prize_title}</div>
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
                  <div style={styles.winnerEmail}>
                    {winner.customer_email || "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <form action={`/api/admin/squares/${game.id}/draw`} method="post">
            <button type="submit" style={styles.drawButton}>
              Draw winners
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
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

const styles: Record<string, CSSProperties> = {
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
  topActions: {
    display: "flex",
    gap: 10,
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
  heroImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
    display: "block",
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
  form: {
    display: "grid",
    gap: 16,
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
  previewImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
    display: "block",
  },
  emptyPreview: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
    fontSize: 42,
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHeadRow: {
    background: "#f8fafc",
  },
  th: {
    textAlign: "left",
    padding: "14px 16px",
    fontSize: 12,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontWeight: 900,
  },
  tr: {
    borderTop: "1px solid #e2e8f0",
  },
  td: {
    padding: "12px",
    verticalAlign: "top",
  },
  submitBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: 16,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 16,
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
  drawButton: {
    padding: "13px 20px",
    border: "none",
    borderRadius: 999,
    background: "#16a34a",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(22,163,74,0.22)",
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
    gridTemplateColumns: "minmax(0, 1fr) 120px minmax(0, 1fr)",
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
};
