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

function moneyFromCents(cents: number) {
  return (Number(cents || 0) / 100).toFixed(2);
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

  const prizeRows =
    savedPrizes.length > 0
      ? savedPrizes
      : [{ title: "First prize", description: "" }];

  return (
    <main style={styles.page}>
      {/* ✅ DASHBOARD NAV (matches raffles) */}
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

      {/* HERO */}
      <section style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>Squares editor</div>
          <h1 style={styles.title}>{game.title}</h1>
          <p style={styles.slug}>/s/{game.slug}</p>
        </div>

        <Link
          href={`/s/${game.slug}`}
          target="_blank"
          style={styles.viewButton}
        >
          View public page ↗
        </Link>
      </section>

      {/* SUMMARY */}
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
        {/* DETAILS */}
        <section style={styles.card}>
          <h2>Game details</h2>

          <div style={styles.grid}>
            <input
              name="title"
              defaultValue={game.title}
              placeholder="Title"
              style={styles.input}
            />

            <input
              name="slug"
              defaultValue={game.slug}
              placeholder="Slug"
              style={styles.input}
            />
          </div>

          <textarea
            name="description"
            defaultValue={game.description ?? ""}
            placeholder="Description"
            style={styles.textarea}
          />

          {/* ✅ IMAGE FIXED */}
          <ImageUploadField currentImageUrl={game.image_url || ""} />
        </section>

        {/* SETUP */}
        <section style={styles.card}>
          <h2>Squares setup</h2>

          <div style={styles.grid}>
            <input
              name="total_squares"
              type="number"
              defaultValue={game.total_squares}
              style={styles.input}
            />

            <input
              name="price_per_square"
              type="number"
              step="0.01"
              defaultValue={moneyFromCents(game.price_per_square_cents)}
              style={styles.input}
            />

            <select
              name="currency"
              defaultValue={currency}
              style={styles.input}
            >
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>

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
          </div>
        </section>

        {/* PRIZES */}
        <section style={styles.card}>
          <h2>Prizes</h2>

          {prizeRows.map((p, i) => (
            <div key={i} style={styles.grid}>
              <input
                name="prize_title"
                defaultValue={p.title || p.name || ""}
                placeholder={`Prize ${i + 1}`}
                style={styles.input}
              />

              <input
                name="prize_description"
                defaultValue={p.description || ""}
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

      {/* WINNERS */}
      <section style={styles.card}>
        <h2>Winners</h2>

        {winners.length ? (
          winners.map((w) => (
            <div key={w.id} style={styles.winner}>
              {w.prize_title} — #{w.square_number} —{" "}
              {firstNameOnly(w.customer_name)}
            </div>
          ))
        ) : (
          <form action={`/api/admin/squares/${game.id}/draw`} method="post">
            <button style={styles.draw}>Draw winners</button>
          </form>
        )}
      </section>
    </main>
  );
}

/* ================= STYLES ================= */

const styles: Record<string, CSSProperties> = {
  page: { maxWidth: 1100, margin: "40px auto", padding: 20 },

  topNav: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  navRight: { display: "flex", gap: 10 },

  navButton: { fontWeight: 800, textDecoration: "none" },

  navGhost: {
    padding: "8px 12px",
    border: "1px solid #ddd",
    borderRadius: 8,
    textDecoration: "none",
  },

  navActive: {
    padding: "8px 12px",
    borderRadius: 8,
    background: "#111",
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
    marginBottom: 20,
  },

  eyebrow: { fontSize: 12, color: "#666" },
  title: { margin: 0 },
  slug: { color: "#666" },

  viewButton: {
    padding: "10px 14px",
    background: "#111",
    color: "#fff",
    borderRadius: 8,
    textDecoration: "none",
  },

  summary: {
    display: "flex",
    gap: 20,
    marginBottom: 20,
  },

  card: {
    border: "1px solid #eee",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 10,
  },

  input: {
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ddd",
  },

  textarea: {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ddd",
    marginBottom: 10,
  },

  save: {
    padding: 12,
    background: "#16a34a",
    color: "#fff",
    borderRadius: 10,
    border: "none",
    fontWeight: 800,
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
  },
};
