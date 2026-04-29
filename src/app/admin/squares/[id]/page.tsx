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

function formatDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 16);
}

export default async function AdminSquaresEditPage({ params }: PageProps) {
  const tenantSlug = await getTenantSlugFromHeaders();
  const game = await getSquaresGameById(params.id);

  if (!tenantSlug || !game || game.tenant_slug !== tenantSlug) {
    notFound();
  }

  const winners = await listSquaresWinners(game.id);
  const currency = game.currency || "GBP";

  const savedPrizes = Array.isArray(game.config_json?.prizes)
    ? (game.config_json.prizes as Prize[])
    : [];

  const prizeRows = Array.from({ length: 20 }).map((_, index) => ({
    title: savedPrizes[index]?.title || savedPrizes[index]?.name || "",
    description: savedPrizes[index]?.description || "",
  }));

  return (
    <main style={styles.page}>
      <section style={styles.topNav}>
        <Link href="/admin" style={styles.navButton}>
          ← Dashboard
        </Link>

        <div style={styles.navRight}>
          <Link href="/admin/raffles" style={styles.navGhost}>
            Raffles
          </Link>

          <Link href="/admin/squares" style={styles.navActive}>
            Squares
          </Link>

          <Link href={`/c/${tenantSlug}`} style={styles.navGhost}>
            Public campaigns
          </Link>

          <Link href="/admin/squares/new" style={styles.navPrimary}>
            + Create squares
          </Link>
        </div>
      </section>

      <section style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>Squares editor</div>
          <h1 style={styles.title}>{game.title}</h1>
          <p style={styles.slug}>/s/{game.slug}</p>
        </div>

        <Link href={`/s/${game.slug}`} target="_blank" style={styles.viewButton}>
          View public page ↗
        </Link>
      </section>

      <section style={styles.summary}>
        <div>
          <strong>Status:</strong> {game.status}
        </div>
        <div>
          <strong>Squares:</strong> {game.total_squares}
        </div>
        <div>
          <strong>Price:</strong> {moneyFromCents(game.price_per_square_cents)}{" "}
          {currency}
        </div>
      </section>

      <form action={`/api/admin/squares/${game.id}`} method="post">
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Game details</h2>

          <div style={styles.grid}>
            <input
              name="title"
              defaultValue={game.title}
              placeholder="Title"
              required
              style={styles.input}
            />

            <input
              name="slug"
              defaultValue={game.slug}
              placeholder="Slug"
              required
              style={styles.input}
            />
          </div>

          <textarea
            name="description"
            defaultValue={game.description ?? ""}
            placeholder="Description"
            style={styles.textarea}
          />

          <div style={{ marginTop: 12 }}>
            <ImageUploadField currentImageUrl={game.image_url || ""} />
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Squares setup</h2>

          <div style={styles.grid}>
            <label style={styles.field}>
              <span style={styles.label}>Draw date</span>
              <input
                name="draw_at"
                type="datetime-local"
                defaultValue={formatDateTimeLocal(game.draw_at)}
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Number of squares</span>
              <input
                name="total_squares"
                type="number"
                min={1}
                max={500}
                defaultValue={game.total_squares}
                required
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Price per square</span>
              <input
                name="price_per_square"
                type="number"
                min={0}
                step="0.01"
                defaultValue={moneyFromCents(game.price_per_square_cents)}
                required
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Currency</span>
              <select name="currency" defaultValue={currency} style={styles.input}>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Status</span>
              <select name="status" defaultValue={game.status} style={styles.input}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
                <option value="drawn">Drawn</option>
              </select>
            </label>
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Prizes</h2>
          <p style={styles.helpText}>
            You can add or edit up to 20 prizes. Blank rows are ignored when saved.
          </p>

          {prizeRows.map((prize, index) => (
            <div key={`prize-${index}`} style={styles.grid}>
              <input
                name="prize_title"
                defaultValue={prize.title}
                placeholder={`Prize ${index + 1}`}
                style={styles.input}
              />

              <input
                name="prize_description"
                defaultValue={prize.description}
                placeholder="Description"
                style={styles.input}
              />
            </div>
          ))}
        </section>

        <button type="submit" style={styles.save}>
          Save squares game
        </button>
      </form>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Winners</h2>

        {winners.length ? (
          winners.map((winner) => (
            <div key={winner.id} style={styles.winner}>
              {winner.prize_title} — #{winner.square_number} —{" "}
              {firstNameOnly(winner.customer_name)}
            </div>
          ))
        ) : (
          <form action={`/api/admin/squares/${game.id}/draw`} method="post">
            <button type="submit" style={styles.draw}>
              Draw winners
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1100,
    margin: "40px auto",
    padding: 20,
  },

  topNav: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
    flexWrap: "wrap",
  },

  navRight: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  navButton: {
    fontWeight: 800,
    textDecoration: "none",
    color: "#111827",
  },

  navGhost: {
    padding: "8px 12px",
    border: "1px solid #ddd",
    borderRadius: 8,
    textDecoration: "none",
    color: "#111827",
    background: "#ffffff",
  },

  navActive: {
    padding: "8px 12px",
    borderRadius: 8,
    background: "#111827",
    color: "#fff",
    textDecoration: "none",
  },

  navPrimary: {
    padding: "8px 12px",
    borderRadius: 8,
    background: "#2563eb",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 800,
  },

  hero: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 20,
    flexWrap: "wrap",
  },

  eyebrow: {
    fontSize: 12,
    color: "#666",
    fontWeight: 800,
  },

  title: {
    margin: 0,
    color: "#0f172a",
  },

  slug: {
    color: "#666",
    margin: "6px 0 0",
  },

  viewButton: {
    padding: "10px 14px",
    background: "#111827",
    color: "#fff",
    borderRadius: 8,
    textDecoration: "none",
    height: "fit-content",
  },

  summary: {
    display: "flex",
    gap: 20,
    marginBottom: 20,
    flexWrap: "wrap",
  },

  card: {
    border: "1px solid #e5e7eb",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    background: "#ffffff",
  },

  sectionTitle: {
    marginTop: 0,
    color: "#0f172a",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
    marginBottom: 10,
  },

  field: {
    display: "grid",
    gap: 6,
  },

  label: {
    fontSize: 13,
    fontWeight: 800,
    color: "#334155",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ddd",
    background: "#ffffff",
    color: "#111827",
  },

  textarea: {
    width: "100%",
    boxSizing: "border-box",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ddd",
    marginBottom: 10,
    minHeight: 100,
    background: "#ffffff",
    color: "#111827",
  },

  helpText: {
    color: "#64748b",
    marginTop: 0,
    marginBottom: 14,
  },

  save: {
    padding: 12,
    background: "#16a34a",
    color: "#fff",
    borderRadius: 10,
    border: "none",
    fontWeight: 800,
    cursor: "pointer",
    marginBottom: 20,
  },

  winner: {
    padding: 10,
    borderBottom: "1px solid #eee",
  },

  draw: {
    padding: 12,
    background: "#2563eb",
    color: "#fff",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
  },
};
