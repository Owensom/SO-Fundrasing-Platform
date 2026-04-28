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

  const savedPrizes = Array.isArray(game.config_json?.prizes)
    ? (game.config_json.prizes as Prize[])
    : [];

  const prizeRows =
    savedPrizes.length > 0
      ? savedPrizes
      : [{ title: "First prize", description: "" }];

  const blankPrizeRows = Array.from({ length: 4 });

  return (
    <main style={styles.page}>
      {/* ✅ DASHBOARD NAV */}
      <nav style={styles.dashboardNav}>
        <Link href="/admin" style={styles.navLink}>Dashboard</Link>
        <Link href="/admin/raffles" style={styles.navLink}>Raffles</Link>
        <Link href="/admin/squares" style={styles.navLinkActive}>Squares</Link>
        <Link href="/admin/squares/new" style={styles.navLink}>Create Squares</Link>
      </nav>

      {/* TOP BAR */}
      <div style={styles.topBar}>
        <div>
          <h1 style={styles.title}>{game.title}</h1>
          <p style={styles.subtitle}>/s/{game.slug}</p>
        </div>

        <div style={styles.actions}>
          <Link href="/admin/squares" style={styles.secondaryBtn}>
            ← Back
          </Link>

          <a
            href={`/s/${game.slug}`}
            target="_blank"
            rel="noreferrer"
            style={styles.primaryBtn}
          >
            View live ↗
          </a>
        </div>
      </div>

      {/* IMAGE PREVIEW */}
      <section style={styles.imageSection}>
        {game.image_url ? (
          <img src={game.image_url} style={styles.image} />
        ) : (
          <div style={styles.imageEmpty}>No image</div>
        )}
      </section>

      {/* SUMMARY */}
      <section style={styles.summary}>
        <div>Status: {game.status}</div>
        <div>Squares: {game.total_squares}</div>
        <div>
          Price: {moneyFromCents(game.price_per_square_cents)}{" "}
          {game.currency}
        </div>
      </section>

      {/* FORM */}
      <form action={`/api/admin/squares/${game.id}`} method="post">
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

            <textarea
              name="description"
              defaultValue={game.description ?? ""}
              placeholder="Description"
              style={styles.textarea}
            />
          </div>

          <ImageUploadField currentImageUrl={game.image_url ?? ""} />
        </section>

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
              defaultValue={game.currency}
              style={styles.input}
            >
              <option>GBP</option>
              <option>EUR</option>
              <option>USD</option>
            </select>

            <select
              name="status"
              defaultValue={game.status}
              style={styles.input}
            >
              <option>draft</option>
              <option>published</option>
              <option>closed</option>
              <option>drawn</option>
            </select>
          </div>
        </section>

        {/* PRIZES */}
        <section style={styles.card}>
          <h2>Prizes</h2>

          {prizeRows.map((p, i) => (
            <div key={i} style={styles.prizeRow}>
              <input
                name="prize_title"
                defaultValue={p.title}
                placeholder="Prize"
                style={styles.input}
              />
              <input
                name="prize_description"
                defaultValue={p.description}
                placeholder="Description"
                style={styles.input}
              />
            </div>
          ))}

          {blankPrizeRows.map((_, i) => (
            <div key={i} style={styles.prizeRow}>
              <input name="prize_title" style={styles.input} />
              <input name="prize_description" style={styles.input} />
            </div>
          ))}
        </section>

        <button style={styles.saveBtn}>Save changes</button>
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
            <button style={styles.drawBtn}>Draw winners</button>
          </form>
        )}
      </section>
    </main>
  );
}

/* ================= STYLES ================= */

const styles: Record<string, CSSProperties> = {
  page: { maxWidth: 1100, margin: "40px auto", padding: 20 },

  dashboardNav: {
    display: "flex",
    gap: 10,
    marginBottom: 20,
  },

  navLink: {
    padding: "10px 14px",
    borderRadius: 999,
    background: "#f1f5f9",
    textDecoration: "none",
    fontWeight: 800,
  },

  navLinkActive: {
    padding: "10px 14px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 800,
  },

  topBar: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  title: { fontSize: 32, margin: 0 },
  subtitle: { color: "#64748b" },

  actions: { display: "flex", gap: 10 },

  primaryBtn: {
    background: "#111827",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: 10,
    textDecoration: "none",
  },

  secondaryBtn: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #ccc",
    textDecoration: "none",
  },

  imageSection: { marginBottom: 20 },

  image: {
    width: "100%",
    height: 250,
    objectFit: "cover",
    borderRadius: 14,
  },

  imageEmpty: {
    height: 250,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f1f5f9",
  },

  summary: {
    display: "flex",
    gap: 20,
    marginBottom: 20,
    fontWeight: 700,
  },

  card: {
    border: "1px solid #e5e7eb",
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },

  grid: {
    display: "grid",
    gap: 12,
  },

  input: {
    padding: 10,
    border: "1px solid #ccc",
    borderRadius: 10,
  },

  textarea: {
    padding: 10,
    border: "1px solid #ccc",
    borderRadius: 10,
  },

  prizeRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 10,
  },

  saveBtn: {
    background: "#16a34a",
    color: "#fff",
    padding: "12px 18px",
    borderRadius: 10,
    border: "none",
  },

  drawBtn: {
    background: "#2563eb",
    color: "#fff",
    padding: "12px 18px",
    borderRadius: 10,
    border: "none",
  },

  winner: {
    padding: 10,
    borderBottom: "1px solid #eee",
  },
};
