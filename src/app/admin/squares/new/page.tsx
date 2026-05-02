import type { CSSProperties } from "react";
import Link from "next/link";
import ImageUploadField from "@/components/ImageUploadField";

export default function NewSquaresGamePage() {
  return (
    <main style={styles.page}>
      <p style={styles.nav}>
        <Link href="/admin" style={styles.link}>
          ← Dashboard
        </Link>{" "}
        <span style={styles.muted}>/</span>{" "}
        <Link href="/admin/squares" style={styles.link}>
          Squares games
        </Link>
      </p>

      <section style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>Create squares</div>
          <h1 style={styles.heroTitle}>Build a new squares game</h1>
          <p style={styles.heroText}>
            Set the public details, board size, pricing, draw date, image and prizes.
          </p>
        </div>

        <div style={styles.tenantPill}>Squares</div>
      </section>

      <section style={styles.summaryGrid}>
        <SummaryCard label="Default squares" value="100" />
        <SummaryCard label="Max squares" value="500" />
        <SummaryCard label="Default price" value="2.00" />
        <SummaryCard label="Currency" value="GBP" />
      </section>

      <form action="/api/admin/squares" method="post" style={styles.form}>
        <FormSection
          title="Game details"
          description="These details appear on the public squares page."
          action={
            <button type="submit" style={styles.submitButton}>
              Create game
            </button>
          }
        >
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

          <div style={styles.imageBlock}>
            <ImageUploadField currentImageUrl="" />
          </div>
        </FormSection>

        <FormSection
          title="Squares setup"
          description="Configure board size and pricing. Maximum board size is 500 squares."
        >
          <div style={styles.twoColumn}>
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
          </div>

          <Field label="Currency">
            <select name="currency" defaultValue="GBP" style={styles.input}>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </Field>
        </FormSection>

        <FormSection
          title="Prizes"
          description="Add prizes in order. Blank rows are ignored when saved."
        >
          <div style={styles.prizeList}>
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} style={styles.prizeRow}>
                <input
                  name="prize_title"
                  defaultValue={index === 0 ? "1st Prize" : ""}
                  placeholder={`Prize ${index + 1}`}
                  style={styles.input}
                />

                <input
                  name="prize_description"
                  placeholder="Optional prize description"
                  style={styles.input}
                />
              </div>
            ))}
          </div>
        </FormSection>

        <section style={styles.submitBar}>
          <div>
            <strong style={{ color: "#0f172a" }}>Ready to create?</strong>
            <div style={styles.submitHelp}>
              Save as draft first if you want to review before publishing.
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

function FormSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.sectionTitle}>{title}</h2>
          {description ? <p style={styles.sectionDescription}>{description}</p> : null}
        </div>
        {action}
      </div>

      <div style={styles.sectionBody}>{children}</div>
    </section>
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1040,
    margin: "40px auto",
    padding: "0 16px 48px",
  },
  nav: {
    margin: "0 0 18px",
    fontWeight: 800,
  },
  link: {
    color: "#2563eb",
    textDecoration: "none",
  },
  muted: {
    color: "#64748b",
  },
  form: {
    display: "grid",
    gap: 18,
    marginTop: 18,
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
    padding: 22,
    borderRadius: 24,
    background: "#0f172a",
    color: "#ffffff",
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
  heroTitle: {
    margin: 0,
    fontSize: 30,
    letterSpacing: "-0.04em",
    lineHeight: 1.08,
  },
  heroText: {
    margin: "10px 0 0",
    color: "#cbd5e1",
    maxWidth: 640,
    lineHeight: 1.55,
  },
  tenantPill: {
    padding: "8px 11px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: 800,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 12,
    marginTop: 18,
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
    fontSize: 26,
    fontWeight: 900,
    marginTop: 4,
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
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 21,
    letterSpacing: "-0.02em",
  },
  sectionDescription: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
  },
  sectionBody: {
    display: "grid",
    gap: 14,
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
    alignItems: "start",
  },
  field: {
    display: "grid",
    gap: 6,
    minWidth: 0,
    alignContent: "start",
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
  imageBlock: {
    marginTop: 4,
  },
  prizeList: {
    display: "grid",
    gap: 10,
  },
  prizeRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: 10,
  },
  submitBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  submitHelp: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 3,
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
};
