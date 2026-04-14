import Link from "next/link";
import React from "react";

export default function HomePage() {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.eyebrow}>SO FUNDRAISING PLATFORM</div>
        <h1 style={styles.title}>Demo Home</h1>
        <p style={styles.text}>
          The app is deployed. Use the links below to open the raffle flow.
        </p>

        <div style={styles.actions}>
          <Link href="/raffles/spring-cash-raffle" style={styles.primaryButton}>
            Open public raffle page
          </Link>

          <Link href="/admin/raffles" style={styles.secondaryButton}>
            Open admin home
          </Link>

          <Link
            href="/admin/raffles/campaign_raffle_spring_cash_2026"
            style={styles.secondaryButton}
          >
            Open raffle admin details
          </Link>

          <Link href="/admin/raffles/create" style={styles.secondaryButton}>
            Create new raffle
          </Link>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#eef0f4",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "96px 24px",
  },
  card: {
    width: "100%",
    maxWidth: 900,
    background: "#fff",
    borderRadius: 20,
    padding: 24,
    border: "1px solid #e5e7eb",
  },
  eyebrow: {
    color: "#425b84",
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 1,
  },
  title: {
    margin: "10px 0 12px",
    fontSize: 32,
  },
  text: {
    margin: 0,
    fontSize: 18,
    color: "#374151",
  },
  actions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 24,
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 42,
    padding: "0 16px",
    borderRadius: 12,
    background: "#0f1f44",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 700,
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 42,
    padding: "0 16px",
    borderRadius: 12,
    background: "#e5e7eb",
    color: "#111827",
    textDecoration: "none",
    fontWeight: 700,
  },
};
