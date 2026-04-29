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
    return {
      background: "#dcfce7",
      color: "#166534",
      borderColor: "#bbf7d0",
    };
  }

  if (status === "drawn") {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
      borderColor: "#bfdbfe",
    };
  }

  if (status === "closed") {
    return {
      background: "#fff7ed",
      color: "#9a3412",
      borderColor: "#fed7aa",
    };
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
  const currency = game.currency || "GBP";
  const config = (game.config_json ?? {}) as any;

  const savedPrizes = Array.isArray(config.prizes)
    ? (config.prizes as Prize[])
    : [];

  const soldSquares = Array.isArray(config.sold) ? config.sold.length : 0;
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

      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Squares editor</div>

          <div style={styles.heroTitleRow}>
            <h1 style={styles.heroTitle}>{game.title}</h1>

            <span style={{ ...styles.statusPill, ...statusStyle(game.status) }}>
              {game.status}
            </span>
          </div>

          <p style={styles.heroSlug}>/s/{game.slug}</p>

          {game.description ? (
            <p style={styles.heroDescription}>{game.description}</p>
          ) : (
            <p style={styles.heroDescriptionMuted}>No description added yet.</p>
          )}
        </div>

        <div style={styles.heroImageWrap}>
          {game.image_url ? (
            <img src={game.image_url} alt={game.title} style={styles.heroImage} />
          ) : (
            <div style={styles.heroImageEmpty}>🔲</div>
          )}
        </div>
      </section>

      <section style={styles.summaryGrid}>
        <SummaryCard label="Price" value={formatMoney(game.price_per_square_cents, currency)} />
        <SummaryCard label="Draw date" value={formatDrawDate(game.draw_at)} />
        <SummaryCard label="Total squares" value={totalSquares} />
        <SummaryCard label="Sold" value={soldSquares} />
        <SummaryCard label="Remaining" value={remainingSquares} />
      </section>

      <section style={styles.progressCard}>
        <div style={styles.progressHeader}>
          <div>
            <strong style={{ color: "#0f172a" }}>Sales progress</strong>
            <div style={styles.mutedSmall}>
              {soldSquares} sold from {totalSquares} squares
            </div>
          </div>

          <div style={styles.progressPercent}>{progress}%</div>
        </div>

        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>
      </section>

      <form action={`/api/admin/squares/${game.id}`} method="post" style={styles.form}>
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Edit squares game</h2>
              <p style={styles.sectionDescription}>
                Update the public details, image, pricing and draw settings.
              </p>
            </div>

            <button type="submit" style={styles.submitButton}>
              Save squares
            </button>
          </div>

          <div style={styles.twoColumn}>
            <Field label="Title">
              <input name="title" defaultValue={game.title} required style={styles.input} />
            </Field>

            <Field label="Slug">
              <input name="slug" defaultValue={game.slug} required style={styles.input} />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              name="description"
              rows={4}
              defaultValue={game.description ?? ""}
              style={styles.textarea}
            />
          </Field>

          <div style={styles.mediaBox}>
            <div>
              <h3 style={styles.subTitle}>Squares image</h3>
              <p style={styles.sectionDescription}>
                Upload or replace the public image for this squares game.
              </p>
              <ImageUploadField currentImageUrl={game.image_url || ""} />
            </div>

            <div style={styles.previewBox}>
              {game.image_url ? (
                <img src={game.image_url} alt={game.title} style={styles.previewImage} />
              ) : (
                <div style={styles.emptyPreview}>🔲</div>
              )}
            </div>
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Squares setup</h2>
              <p style={styles.sectionDescription}>
                Configure board size, pricing, draw date and status.
              </p>
            </div>
          </div>

          <div style={styles.threeColumn}>
            <Field label="Draw date">
              <input
                name="draw_at"
                type="datetime-local"
                defaultValue={formatDateTimeLocal(game.draw_at)}
                style={styles.input}
              />
            </Field>

            <Field label="Total squares">
              <input
                name="total_squares"
                type="number"
                min={1}
                max={500}
                defaultValue={game.total_squares}
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
                defaultValue={moneyFromCents(game.price_per_square_cents)}
                required
                style={styles.input}
              />
            </Field>

            <Field label="Currency">
              <select name="currency" defaultValue={currency} style={styles.input}>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </Field>

            <Field label="Status">
              <select name="status" defaultValue={game.status} style={styles.input}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
                <option value="drawn">Drawn</option>
              </select>
            </Field>
          </div>
        </section>

        <section style={styles.section}>
          <SquaresPrizeSettings initialPrizes={savedPrizes} />
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Auto draw range</h2>
              <p style={styles.sectionDescription}>
                Choose which prize numbers the randomizer should draw. Example:
                set from 6 to 999 to keep the top 5 prizes for a live draw.
              </p>
            </div>
          </div>

          <div style={styles.twoColumn}>
            <Field label="Auto draw from prize number">
              <input
                name="auto_draw_from_prize"
                type="number"
                min={1}
                defaultValue={Number(config.auto_draw_from_prize || 1)}
                placeholder="6"
                style={styles.input}
              />
            </Field>

            <Field label="Auto draw to prize number">
              <input
                name="auto_draw_to_prize"
                type="number"
                min={1}
                defaultValue={Number(config.auto_draw_to_prize || 999)}
                placeholder="999"
                style={styles.input}
              />
            </Field>
          </div>
        </section>

        <section style={styles.submitBar}>
          <div>
            <strong style={{ color: "#0f172a" }}>Save changes</strong>
            <div style={styles.mutedSmall}>
              This updates the public squares page and admin values.
            </div>
          </div>

          <button type="submit" style={styles.submitButton}>
            Save squares
          </button>
        </section>
      </form>
            <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Winners</h2>
            <p style={styles.sectionDescription}>
              View winners, auto draw remaining prizes, or manually add a live draw winner.
            </p>
          </div>
        </div>

        {winners.length ? (
          <div style={styles.winnerList}>
            {winners.map((winner) => (
              <div key={winner.id} style={styles.winnerCard}>
                <div>
                  <div style={styles.winnerLabel}>Prize</div>
                  <div style={styles.winnerValue}>{winner.prize_title}</div>
                </div>

                <div>
                  <div style={styles.winnerLabel}>Square</div>
                  <div style={styles.winnerValue}>#{winner.square_number}</div>
                </div>

                <div>
                  <div style={
