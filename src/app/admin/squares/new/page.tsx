import type { CSSProperties } from "react";
import Link from "next/link";
import ImageUploadField from "@/components/ImageUploadField";

export default function NewSquaresGamePage() {
  return (
    <main style={styles.page}>
      {/* HEADER */}
      <div style={styles.topBar}>
        <div>
          <p style={styles.nav}>
            <Link href="/admin" style={styles.link}>
              ← Dashboard
            </Link>{" "}
            <span style={styles.muted}>/</span>{" "}
            <Link href="/admin/squares" style={styles.link}>
              Squares games
            </Link>
          </p>

          <h1 style={styles.title}>Create squares game</h1>

          <p style={styles.subtitle}>
            Set up a new squares game with image, pricing, draw date, board size and prizes.
          </p>
        </div>
      </div>

      <form action="/api/admin/squares" method="post" style={styles.form}>
        {/* GAME DETAILS */}
        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Game details</h2>
              <p style={styles.sectionText}>
                These settings control the public squares page.
              </p>
            </div>

            <button type="submit" style={styles.primaryButton}>
              Create game
            </button>
          </div>

          <div style={styles.grid}>
            <label style={styles.label}>
              Title
              <input name="title" required placeholder="Summer squares" style={styles.input} />
            </label>

            <label style={styles.label}>
              Slug
              <input name="slug" placeholder="summer-squares" style={styles.input} />
            </label>

            <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
              Description
              <textarea
                name="description"
                rows={4}
                placeholder="Describe the game, prize and draw details."
                style={styles.textarea}
              />
            </label>

            <label style={styles.label}>
              Draw date
              <input name="draw_at" type="datetime-local" style={styles.input} />
            </label>
          </div>

          <div style={{ marginTop: 18 }}>
            <ImageUploadField currentImageUrl="" />
          </div>
        </section>

        {/* SETUP */}
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Squares setup</h2>
          <p style={styles.sectionText}>
            Configure board size and pricing. Maximum board size is 500 squares.
          </p>

          <div style={styles.grid}>
            <label style={styles.label}>
              Number of squares
              <input
                name="total_squares"
                type="number"
                min={1}
                max={500}
                defaultValue={100}
                required
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Price per square
              <input
                name="price_per_square"
                type="number"
                min={0}
                step="0.01"
                defaultValue="2.00"
                required
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Currency
              <select name="currency" defaultValue="GBP" style={styles.input}>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </label>

            <label style={styles.label}>
              Status
              <select name="status" defaultValue="draft" style={styles.input}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
              </select>
            </label>
          </div>
        </section>

        {/* PRIZES */}
        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Prizes</h2>
              <p style={styles.sectionText}>
                Add prizes in order. Leave blank rows unused.
              </p>
            </div>
          </div>

          <div style={styles.prizeList}>
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} style={styles.prizeRow}>
                <input
                  name="prize_title"
                  placeholder={index === 0 ? "1st Prize" : `Prize ${index + 1}`}
                  defaultValue={index === 0 ? "1st Prize" : ""}
                  style={styles.input}
                />

                <input
                  name="prize_description"
                  placeholder="Optional description"
                  style={styles.input}
                />
              </div>
            ))}
          </div>
        </section>

        {/* FOOTER */}
        <div style={styles.footer}>
          <button type="submit" style={styles.primaryButton}>
            Create squares game
          </button>
        </div>
      </form>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1040,
    margin: "40px auto",
    padding: 20,
  },
  form: {
    display: "grid",
    gap: 18,
  },
  topBar: {
    marginBottom: 24,
  },
  nav: {
    fontWeight: 700,
    marginBottom: 8,
  },
  link: {
    color: "#2563eb",
    textDecoration: "none",
  },
  muted: {
    color: "#64748b",
  },
  title: {
    fontSize: 32,
    margin: 0,
  },
  subtitle: {
    marginTop: 8,
    color: "#64748b",
  },
  card: {
    padding: 20,
    borderRadius: 20,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 20,
  },
  sectionText: {
    color: "#64748b",
    fontSize: 14,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  label: {
    display: "grid",
    gap: 6,
    fontWeight: 800,
  },
  input: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
  },
  textarea: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
  },
  primaryButton: {
    background: "#1683f8",
    color: "#fff",
    border: "none",
    borderRadius: 999,
    padding: "12px 18px",
    fontWeight: 900,
    cursor: "pointer",
  },
  prizeList: {
    display: "grid",
    gap: 10,
  },
  prizeRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
  },
};
