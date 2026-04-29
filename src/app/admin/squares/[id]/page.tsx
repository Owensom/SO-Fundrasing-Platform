import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import {
  getSquaresGameById,
  listSquaresWinners,
} from "../../../../../api/_lib/squares-repo";
import ImageUploadField from "@/components/ImageUploadField";
import SquaresPrizeSettings from "./SquaresPrizeSettings";

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
  const config = (game.config_json ?? {}) as any;

  const savedPrizes = Array.isArray(config.prizes)
    ? (config.prizes as Prize[])
    : [];

  return (
    <main style={styles.page}>
      {/* HEADER */}
      <section style={styles.header}>
        <div>
          <div style={styles.badge}>Squares editor</div>
          <h1 style={styles.title}>{game.title}</h1>
          <p style={styles.slug}>/s/{game.slug}</p>
        </div>

        <div style={styles.nav}>
          <Link href="/admin" style={styles.navButton}>
            ← Dashboard
          </Link>

          <Link href="/admin/raffles" style={styles.navButton}>
            Raffles
          </Link>

          <Link href="/admin/squares" style={styles.navActive}>
            Squares
          </Link>

          <Link href={`/c/${tenantSlug}`} target="_blank" style={styles.navButton}>
            Public page
          </Link>
        </div>
      </section>

      {/* SUMMARY */}
      <section style={styles.stats}>
        <Stat label="Status" value={game.status} />
        <Stat label="Squares" value={game.total_squares} />
        <Stat
          label="Price"
          value={`${moneyFromCents(game.price_per_square_cents)} ${currency}`}
        />
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

          <ImageUploadField currentImageUrl={game.image_url || ""} />
        </section>

        {/* SETUP */}
        <section style={styles.card}>
          <h2>Squares setup</h2>

          <div style={styles.grid}>
            <input
              name="draw_at"
              type="datetime-local"
              defaultValue={formatDateTimeLocal(game.draw_at)}
              style={styles.input}
            />

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

            <select name="currency" defaultValue={currency} style={styles.input}>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>

            <select name="status" defaultValue={game.status} style={styles.input}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
              <option value="drawn">Drawn</option>
            </select>
          </div>
        </section>

        {/* PRIZES */}
        <section style={styles.card}>
          <SquaresPrizeSettings initialPrizes={savedPrizes} />
        </section>

        {/* AUTO DRAW */}
        <section style={styles.card}>
          <h2>Auto draw range</h2>

          <div style={styles.grid}>
            <input
              name="auto_draw_from_prize"
              type="number"
              defaultValue={config.auto_draw_from_prize || 1}
              placeholder="From"
              style={styles.input}
            />

            <input
              name="auto_draw_to_prize"
              type="number"
              defaultValue={config.auto_draw_to_prize || 999}
              placeholder="To"
              style={styles.input}
            />
          </div>
        </section>

        <button type="submit" style={styles.save}>
          Save
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

function Stat({ label, value }: any) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

/* ================= STYLES ================= */

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: 24,
    background: "#f8fafc",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 20,
    flexWrap: "wrap",
  },

  badge: {
    fontSize: 12,
    fontWeight: 900,
    color: "#0369a1",
  },

  title: {
    margin: "4px 0",
  },

  slug: {
    color: "#64748b",
  },

  nav: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  navButton: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #ddd",
    textDecoration: "none",
  },

  navActive: {
    padding: "10px 14px",
    borderRadius: 999,
    background: "#111",
    color: "#fff",
    textDecoration: "none",
  },

  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))",
    gap: 10,
    marginBottom: 20,
  },

  statCard: {
    padding: 14,
    borderRadius: 12,
    background: "#fff",
    border: "1px solid #eee",
  },

  statLabel: {
    fontSize: 12,
    color: "#64748b",
  },

  statValue: {
    fontWeight: 900,
  },

  card: {
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
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
    marginTop: 10,
  },

  save: {
    padding: 12,
    background: "#16a34a",
    color: "#fff",
    borderRadius: 10,
    border: "none",
    fontWeight: 900,
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
