import type { CSSProperties } from "react";
import Link from "next/link";
import ImageUploadField from "@/components/ImageUploadField";

export default function NewSquaresGamePage() {
  return (
    <main style={styles.page}>
      <section style={styles.topBar}>
        <Link href="/admin/squares" style={styles.backLink}>
          ← Back to squares
        </Link>

        <Link href="/admin" style={styles.publicLink}>
          Dashboard
        </Link>
      </section>

      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Squares creator</div>

          <div style={styles.heroTitleRow}>
            <h1 style={styles.heroTitle}>Create squares game</h1>
          </div>

          <p style={styles.heroSlug}>/admin/squares/new</p>

          <p style={styles.heroDescription}>
            Set up a new squares game with image, pricing, draw date, board size
            and prizes.
          </p>
        </div>

        <div style={styles.heroImageWrap}>
          <div style={styles.heroImageEmpty}>🔲</div>
        </div>
      </section>

      <form action="/api/admin/squares" method="post" style={styles.form}>
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Game details</h2>
              <p style={styles.sectionDescription}>
                These settings control the public squares page.
              </p>
            </div>

            <button type="submit" style={styles.submitButton}>
              Create game
            </button>
          </div>

          <div style={styles.twoColumn}>
            <Field label="Title">
              <input
                name="title"
                required
                placeholder="Summer squares"
                style={styles.input}
              />
            </Field>

            <Field label="Slug">
              <input
                name="slug"
                placeholder="summer-squares"
                style={styles.input}
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              name="description"
              rows={4}
              placeholder="Describe the game, prize and draw details."
              style={styles.textarea}
            />
          </Field>

          <div style={styles.mediaBox}>
            <div>
              <h3 style={styles.subTitle}>Squares image</h3>
              <p style={styles.sectionDescription}>
                Upload or paste an image URL for the public squares page.
              </p>

              <ImageUploadField currentImageUrl="" />
            </div>

            <div style={styles.previewBox}>
              <div style={styles.emptyPreview}>🔲</div>
            </div>
          </div>

          <div style={styles.twoColumn}>
            <Field label="Draw date">
              <input name="draw_at" type="datetime-local" style={styles.input} />
            </Field>

            <Field label="Status">
              <select name="status" defaultValue="draft" style={styles.input}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
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
                defaultValue={100}
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
                defaultValue="2.00"
                required
                style={styles.input}
              />
            </Field>

            <Field label="Currency">
              <select name="currency" defaultValue="GBP" style={styles.input}>
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
                {Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} style={styles.tr}>
                    <td style={styles.td}>
                      <input
                        name="prize_title"
                        defaultValue={index === 0 ? "1st Prize" : ""}
                        placeholder={`Prize ${index + 1}`}
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
            <strong style={{ color: "#0f172a" }}>Create squares game</strong>
            <div style={styles.mutedSmall}>
              This creates a new public squares campaign for this tenant.
            </div>
          </div>

          <button type="submit" style={styles.submitButton}>
            Create squares game
          </button>
        </section>
      </form>
    </main>
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
};
