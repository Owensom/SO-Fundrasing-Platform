import type { CSSProperties } from "react";
import Link from "next/link";
import ImageUploadField from "@/components/ImageUploadField";

export default function NewSquaresGamePage() {
  return (
    <main style={pageStyle}>
      <div style={topBarStyle}>
        <div>
          <p style={navStyle}>
            <Link href="/admin" style={linkStyle}>
              ← Dashboard
            </Link>{" "}
            <span style={mutedStyle}>/</span>{" "}
            <Link href="/admin/squares" style={linkStyle}>
              Squares games
            </Link>
          </p>

          <h1 style={titleStyle}>Create squares game</h1>

          <p style={subtitleStyle}>
            Set up a new squares game with image, pricing, draw date, board size
            and prizes.
          </p>
        </div>
      </div>

      <form action="/api/admin/squares" method="post">
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Game details</h2>
              <p style={sectionTextStyle}>
                These settings control the public squares page.
              </p>
            </div>

            <button type="submit" style={saveButtonStyle}>
              Create game
            </button>
          </div>

          <div style={gridStyle}>
            <label style={labelStyle}>
              Title
              <input
                name="title"
                required
                placeholder="Summer squares"
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Slug
              <input
                name="slug"
                placeholder="summer-squares"
                style={inputStyle}
              />
            </label>

            <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
              Description
              <textarea
                name="description"
                rows={4}
                placeholder="Describe the game, prize and draw details."
                style={textareaStyle}
              />
            </label>

            <label style={labelStyle}>
              Draw date
              <input name="draw_at" type="datetime-local" style={inputStyle} />
            </label>
          </div>

          <div style={{ marginTop: 18 }}>
            <ImageUploadField currentImageUrl="" />
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Squares setup</h2>
          <p style={sectionTextStyle}>
            Configure board size and pricing. Maximum board size is 500 squares.
          </p>

          <div style={gridStyle}>
            <label style={labelStyle}>
              Number of squares
              <input
                name="total_squares"
                type="number"
                min={1}
                max={500}
                defaultValue={100}
                required
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Price per square
              <input
                name="price_per_square"
                type="number"
                min={0}
                step="0.01"
                defaultValue="2.00"
                required
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Currency
              <select name="currency" defaultValue="GBP" style={inputStyle}>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </label>

            <label style={labelStyle}>
              Status
              <select name="status" defaultValue="draft" style={inputStyle}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
              </select>
            </label>
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Prizes</h2>
          <p style={sectionTextStyle}>
            Add one prize per row. Blank rows are ignored when saved.
          </p>

          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr style={tableHeadRowStyle}>
                  <th style={thStyle}>Prize</th>
                  <th style={thStyle}>Description</th>
                </tr>
              </thead>

              <tbody>
                {Array.from({ length: 20 }).map((_, index) => (
                  <tr key={index} style={trStyle}>
                    <td style={tdStyle}>
                      <input
                        name="prize_title"
                        defaultValue={index === 0 ? "1st Prize" : ""}
                        placeholder={`Prize ${index + 1}`}
                        style={inputStyle}
                      />
                    </td>

                    <td style={tdStyle}>
                      <input
                        name="prize_description"
                        placeholder="Optional prize description"
                        style={inputStyle}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" style={saveButtonStyle}>
            Create squares game
          </button>
        </div>
      </form>
    </main>
  );
}

const pageStyle: CSSProperties = {
  maxWidth: 1120,
  margin: "40px auto",
  padding: 24,
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const topBarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "flex-start",
  marginBottom: 24,
};

const navStyle: CSSProperties = {
  margin: "0 0 10px",
  fontWeight: 700,
};

const linkStyle: CSSProperties = {
  color: "#2563eb",
  textDecoration: "none",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 36,
  lineHeight: 1.1,
  color: "#0f172a",
};

const subtitleStyle: CSSProperties = {
  marginTop: 10,
  color: "#64748b",
  maxWidth: 680,
};

const cardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 22,
  background: "#ffffff",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
  marginBottom: 18,
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 18,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 22,
  color: "#0f172a",
};

const sectionTextStyle: CSSProperties = {
  marginTop: 6,
  color: "#64748b",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
};

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  fontWeight: 900,
  color: "#0f172a",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "11px 12px",
  fontSize: 15,
};

const textareaStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "11px 12px",
  fontSize: 15,
};

const saveButtonStyle: CSSProperties = {
  border: "1px solid #111827",
  borderRadius: 12,
  padding: "12px 18px",
  background: "#111827",
  color: "#ffffff",
  fontWeight: 950,
  cursor: "pointer",
};

const tableWrapStyle: CSSProperties = {
  overflowX: "auto",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const tableHeadRowStyle: CSSProperties = {
  background: "#f8fafc",
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: 12,
  color: "#475569",
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const trStyle: CSSProperties = {
  borderTop: "1px solid #e5e7eb",
};

const tdStyle: CSSProperties = {
  padding: 12,
  verticalAlign: "top",
};

const mutedStyle: CSSProperties = {
  color: "#64748b",
};
