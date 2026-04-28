import type { CSSProperties } from "react";
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

function firstNameOnly(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || "Winner";
}

function moneyFromCents(cents: number) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function safePrizesJson(value: unknown) {
  return JSON.stringify(Array.isArray(value) ? value : [], null, 2);
}

export default async function AdminSquaresEditPage({ params }: PageProps) {
  const tenantSlug = await getTenantSlugFromHeaders();
  const game = await getSquaresGameById(params.id);

  if (!tenantSlug || !game || game.tenant_slug !== tenantSlug) {
    notFound();
  }

  const winners = await listSquaresWinners(game.id);
  const prizes = Array.isArray(game.config_json?.prizes)
    ? game.config_json.prizes
    : [];
  const prizesJson = safePrizesJson(prizes);

  return (
    <main style={pageStyle}>
      <div style={topBarStyle}>
        <div>
          <p style={navStyle}>
            <a href="/admin" style={linkStyle}>
              ← Dashboard
            </a>{" "}
            <span style={mutedStyle}>/</span>{" "}
            <a href="/admin/squares" style={linkStyle}>
              Squares games
            </a>
          </p>

          <h1 style={titleStyle}>Edit squares game</h1>

          <p style={subtitleStyle}>
            Manage the public squares game, pricing, image, prizes and winner
            draw.
          </p>
        </div>

        <div style={actionRowStyle}>
          <a href="/admin/squares/new" style={secondaryButtonStyle}>
            Create another
          </a>

          <a
            href={`/s/${game.slug}`}
            target="_blank"
            rel="noreferrer"
            style={darkButtonStyle}
          >
            View public page ↗
          </a>
        </div>
      </div>

      <section style={summaryGridStyle}>
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Status</div>
          <div style={statusBadgeStyle}>{game.status}</div>
        </div>

        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Total squares</div>
          <div style={summaryValueStyle}>{game.total_squares}</div>
        </div>

        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Price</div>
          <div style={summaryValueStyle}>
            {moneyFromCents(game.price_per_square_cents)} {game.currency}
          </div>
        </div>
      </section>

      <form action={`/api/admin/squares/${game.id}`} method="post">
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Game details</h2>
              <p style={sectionTextStyle}>
                These settings control the public squares page.
              </p>
            </div>

            <button type="submit" style={saveButtonStyle}>
              Save changes
            </button>
          </div>

          <div style={gridStyle}>
            <label style={labelStyle}>
              Title
              <input
                name="title"
                defaultValue={game.title}
                required
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Slug
              <input
                name="slug"
                defaultValue={game.slug}
                required
                style={inputStyle}
              />
            </label>

            <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
              Description
              <textarea
                name="description"
                rows={4}
                defaultValue={game.description ?? ""}
                style={textareaStyle}
              />
            </label>
          </div>

          <div style={{ marginTop: 18 }}>
            <ImageUploadField currentImageUrl={game.image_url ?? ""} />
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Squares setup</h2>
          <p style={sectionTextStyle}>
            Configure the board size and square price. Maximum supported board
            size is 500 squares.
          </p>

          <div style={gridStyle}>
            <label style={labelStyle}>
              Number of squares
              <input
                name="total_squares"
                type="number"
                min={1}
                max={500}
                defaultValue={game.total_squares}
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
                defaultValue={moneyFromCents(game.price_per_square_cents)}
                required
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Currency
              <select
                name="currency"
                defaultValue={game.currency ?? "GBP"}
                style={inputStyle}
              >
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </label>

            <label style={labelStyle}>
              Status
              <select
                name="status"
                defaultValue={game.status}
                style={inputStyle}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
                <option value="drawn">Drawn</option>
              </select>
            </label>
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Prizes</h2>
          <p style={sectionTextStyle}>
            This keeps your existing save route safe by using the same prizes
            JSON field. The next upgrade can convert this into a proper editable
            table like raffles once we check the save API.
          </p>

          {prizes.length > 0 && (
            <div style={prizeListStyle}>
              {prizes.map((prize: any, index: number) => (
                <div key={index} style={prizeCardStyle}>
                  <div style={{ fontWeight: 900 }}>
                    {prize.title || prize.name || `Prize ${index + 1}`}
                  </div>
                  {prize.description ? (
                    <div style={mutedStyle}>{prize.description}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <label style={labelStyle}>
            Prizes JSON
            <textarea
              name="prizes"
              rows={8}
              defaultValue={prizesJson}
              style={{
                ...textareaStyle,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
              }}
            />
          </label>
        </section>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" style={saveButtonStyle}>
            Save squares game
          </button>
        </div>
      </form>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Draw winners</h2>

        {winners.length > 0 ? (
          <div style={winnerListStyle}>
            {winners.map((winner) => (
              <div key={winner.id} style={winnerCardStyle}>
                <div style={{ fontWeight: 900 }}>{winner.prize_title}</div>
                <div style={mutedStyle}>
                  Square #{winner.square_number} —{" "}
                  {firstNameOnly(winner.customer_name)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <form action={`/api/admin/squares/${game.id}/draw`} method="post">
            <button type="submit" style={drawButtonStyle}>
              Draw winners
            </button>
          </form>
        )}
      </section>
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

const actionRowStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const darkButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 12,
  padding: "12px 16px",
  background: "#111827",
  color: "white",
  fontWeight: 900,
  textDecoration: "none",
  border: "1px solid #111827",
};

const secondaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 12,
  padding: "12px 16px",
  background: "#ffffff",
  color: "#111827",
  fontWeight: 900,
  textDecoration: "none",
  border: "1px solid #d1d5db",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 14,
  marginBottom: 18,
};

const summaryCardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 18,
  background: "#ffffff",
};

const summaryLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  fontWeight: 800,
  marginBottom: 8,
};

const summaryValueStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 950,
  color: "#0f172a",
};

const statusBadgeStyle: CSSProperties = {
  display: "inline-flex",
  borderRadius: 999,
  padding: "6px 12px",
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 900,
  textTransform: "capitalize",
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
  alignItems: "flex-start",
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

const drawButtonStyle: CSSProperties = {
  border: "1px solid #15803d",
  borderRadius: 12,
  padding: "12px 18px",
  background: "#16a34a",
  color: "#ffffff",
  fontWeight: 950,
  cursor: "pointer",
};

const prizeListStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  marginBottom: 16,
};

const prizeCardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 14,
  background: "#f8fafc",
};

const winnerListStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const winnerCardStyle: CSSProperties = {
  border: "1px solid #bbf7d0",
  borderRadius: 14,
  padding: 14,
  background: "#f0fdf4",
};

const mutedStyle: CSSProperties = {
  color: "#64748b",
};
