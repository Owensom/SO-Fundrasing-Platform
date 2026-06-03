"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function cleanInternalPath(value: string | null | undefined, fallback: string) {
  const clean = String(value || "").trim();

  if (!clean) return fallback;
  if (!clean.startsWith("/")) return fallback;
  if (clean.startsWith("//")) return fallback;

  return clean;
}

export default function PublicExitWarningPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const continueTo = cleanInternalPath(
    searchParams?.get("continueTo"),
    "/admin",
  );

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.logoPlate}>
          <img
            src="/brand/so-logo-full.png"
            alt="SO Fundraising Platform"
            style={styles.logo}
          />
        </div>

        <div style={styles.icon}>!</div>

        <p style={styles.kicker}>Leaving the public campaign page</p>

        <h1 style={styles.title}>This area is for organisers and admins</h1>

        <p style={styles.text}>
          Buyers should stay on the public campaign page to buy raffle tickets,
          choose squares, book event seats, bid, donate or contact the
          organiser.
        </p>

        <div style={styles.notice}>
          If you are a supporter, use the public campaign buttons instead. If
          you are the organiser, you can continue to the admin area.
        </div>

        <div style={styles.actions}>
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
                return;
              }

              router.push("/");
            }}
            style={styles.primaryButton}
          >
            Stay on public page
          </button>

          <Link href={continueTo} style={styles.secondaryButton}>
            Continue to admin
          </Link>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 18,
    background:
      "radial-gradient(circle at top left, rgba(15,118,110,0.16), transparent 34%), radial-gradient(circle at bottom right, rgba(194,65,45,0.12), transparent 34%), #f8fafc",
    color: "#0f172a",
  },

  card: {
    width: "min(100%, 720px)",
    display: "grid",
    justifyItems: "center",
    gap: 16,
    padding: "clamp(22px, 5vw, 38px)",
    borderRadius: 30,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 24px 70px rgba(15,23,42,0.14)",
    textAlign: "center",
  },

  logoPlate: {
    width: "min(100%, 320px)",
    padding: 14,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
  },

  logo: {
    display: "block",
    width: "100%",
    height: "auto",
    objectFit: "contain",
  },

  icon: {
    display: "grid",
    placeItems: "center",
    width: 58,
    height: 58,
    borderRadius: 20,
    background: "linear-gradient(135deg, #0f766e, #c2412d)",
    color: "#ffffff",
    fontSize: 28,
    fontWeight: 950,
    boxShadow: "0 14px 30px rgba(15,118,110,0.22)",
  },

  kicker: {
    margin: 0,
    color: "#0f766e",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },

  title: {
    margin: 0,
    maxWidth: 600,
    fontSize: "clamp(32px, 7vw, 54px)",
    lineHeight: 0.98,
    letterSpacing: "-0.065em",
  },

  text: {
    margin: 0,
    maxWidth: 580,
    color: "#475569",
    fontSize: 16,
    lineHeight: 1.6,
    fontWeight: 750,
  },

  notice: {
    width: "100%",
    padding: 16,
    borderRadius: 20,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    fontSize: 14,
    lineHeight: 1.55,
    fontWeight: 800,
    boxSizing: "border-box",
  },

  actions: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
    width: "min(100%, 520px)",
  },

  primaryButton: {
    minHeight: 50,
    borderRadius: 999,
    border: "1px solid #0f766e",
    background: "#0f766e",
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 950,
    cursor: "pointer",
    padding: "12px 16px",
  },

  secondaryButton: {
    minHeight: 50,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 950,
    textDecoration: "none",
    padding: "12px 16px",
  },
};
