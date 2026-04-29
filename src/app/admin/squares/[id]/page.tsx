import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import {
  getSquaresGameById,
  listSquaresSales,
  listSquaresWinners,
} from "../../../../../api/_lib/squares-repo";
import ImageUploadField from "@/components/ImageUploadField";
import SquaresPrizeSettings from "./SquaresPrizeSettings";
import DramaticSquaresDraw from "./DramaticSquaresDraw";

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

type SoldSquareOption = {
  squareNumber: number;
  customerName: string;
  customerEmail: string;
};

function firstNameOnly(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || "Winner";
}

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function formatMoney(cents: number | null | undefined, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(Number(cents || 0) / 100);
  } catch {
    return `${moneyFromCents(cents)} ${currency || "GBP"}`;
  }
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

function getProgressPercent(sold: number, total: number) {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((sold / total) * 100)));
}

function statusStyle(status: string): CSSProperties {
  if (status === "published") {
    return { background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0" };
  }
  if (status === "drawn") {
    return { background: "#dbeafe", color: "#1d4ed8", borderColor: "#bfdbfe" };
  }
  if (status === "closed") {
    return { background: "#fff7ed", color: "#9a3412", borderColor: "#fed7aa" };
  }
  return {
    background: "#f1f5f9",
    color: "#475569",
    borderColor: "#e2e8f0",
  };
}

export default async function AdminSquaresEditPage({ params }: PageProps) {
  const tenantSlug = await getTenantSlugFromHeaders();
  const game = await getSquaresGameById(params.id);

  if (!tenantSlug || !game || game.tenant_slug !== tenantSlug) {
    notFound();
  }

  const winners = await listSquaresWinners(game.id);
  const sales = await listSquaresSales(game.id);

  const currency = game.currency || "GBP";
  const config = (game.config_json ?? {}) as any;

  const savedPrizes = Array.isArray(config.prizes)
    ? (config.prizes as Prize[])
    : [];

  const soldSquareOptions: SoldSquareOption[] = sales
    .flatMap((sale: any) =>
      Array.isArray(sale.squares)
        ? sale.squares.map((squareNumber: number | string) => ({
            squareNumber: Number(squareNumber),
            customerName: String(sale.customer_name || "Supporter"),
            customerEmail: String(sale.customer_email || ""),
          }))
        : [],
    )
    .filter(
      (entry) =>
        Number.isInteger(entry.squareNumber) &&
        entry.squareNumber >= 1 &&
        entry.squareNumber <= Number(game.total_squares || 0),
    )
    .sort((a, b) => a.squareNumber - b.squareNumber);

  const soldSquares = soldSquareOptions.length;
  const totalSquares = Number(game.total_squares || 0);
  const remainingSquares = Math.max(totalSquares - soldSquares, 0);
  const progress = getProgressPercent(soldSquares, totalSquares);

  return (
    <main style={styles.page}>
      <section style={styles.topBar}>
        <Link href="/admin/squares" style={styles.backLink}>
          ← Back to squares
        </Link>

        <Link href={`/s/${game.slug}`} target="_blank" style={styles.publicLink}>
          View campaign page
        </Link>
      </section>

      {/* HERO */}
      <section style={styles.hero}>
        <div>
          <h1 style={styles.heroTitle}>{game.title}</h1>
          <span style={{ ...styles.statusPill, ...statusStyle(game.status) }}>
            {game.status}
          </span>
          <p style={styles.heroSlug}>/s/{game.slug}</p>
        </div>
      </section>

      {/* SUMMARY */}
      <section style={styles.summaryGrid}>
        <SummaryCard label="Price" value={formatMoney(game.price_per_square_cents, currency)} />
        <SummaryCard label="Draw date" value={formatDrawDate(game.draw_at)} />
        <SummaryCard label="Total squares" value={totalSquares} />
        <SummaryCard label="Sold" value={soldSquares} />
        <SummaryCard label="Remaining" value={remainingSquares} />
      </section>

      {/* DRAMATIC DRAW (NEW) */}
      <section style={styles.section}>
        <DramaticSquaresDraw
          gameId={game.id}
          soldSquareOptions={soldSquareOptions}
        />
      </section>

      {/* WINNERS */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Winners</h2>

        {winners.length ? (
          <div style={styles.winnerList}>
            {winners.map((winner) => (
              <div key={winner.id} style={styles.winnerCard}>
                <div>{winner.prize_title}</div>
                <div>#{winner.square_number}</div>
                <div>{firstNameOnly(winner.customer_name)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.noWinnersBox}>No winners yet.</div>
        )}
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: any) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { maxWidth: 1100, margin: "0 auto", padding: 20 },
  topBar: { display: "flex", justifyContent: "space-between", marginBottom: 20 },
  hero: { marginBottom: 20 },
  heroTitle: { fontSize: 28 },
  heroSlug: { color: "#64748b" },
  statusPill: { padding: 6, borderRadius: 8, border: "1px solid" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 },
  summaryCard: { padding: 10, border: "1px solid #e2e8f0", borderRadius: 10 },
  summaryLabel: { fontSize: 12 },
  summaryValue: { fontSize: 18, fontWeight: 700 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 20 },
  winnerList: { display: "grid", gap: 10 },
  winnerCard: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr" },
  noWinnersBox: { padding: 10, background: "#f1f5f9" },
  backLink: { textDecoration: "none" },
  publicLink: { textDecoration: "none" },
};
