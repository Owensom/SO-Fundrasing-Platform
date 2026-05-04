"use client";

import type { CSSProperties } from "react";

export default function BuyerDetailsFields({
  buyerName,
  buyerEmail,
  onBuyerNameChange,
  onBuyerEmailChange,
  dark = false,
}: {
  buyerName: string;
  buyerEmail: string;
  onBuyerNameChange: (value: string) => void;
  onBuyerEmailChange: (value: string) => void;
  dark?: boolean;
}) {
  return (
    <div style={dark ? styles.darkBox : styles.lightBox}>
      <h4 style={dark ? styles.darkTitle : styles.lightTitle}>Your details</h4>

      <label style={styles.field}>
        <span style={dark ? styles.darkLabel : styles.lightLabel}>Name</span>
        <input
          value={buyerName}
          onChange={(event) => onBuyerNameChange(event.target.value)}
          placeholder="Full name"
          style={styles.input}
        />
      </label>

      <label style={styles.field}>
        <span style={dark ? styles.darkLabel : styles.lightLabel}>Email</span>
        <input
          value={buyerEmail}
          onChange={(event) => onBuyerEmailChange(event.target.value)}
          placeholder="Email address"
          type="email"
          style={styles.input}
        />
      </label>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  lightBox: {
    display: "grid",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  darkBox: {
    display: "grid",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.055)",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  lightTitle: {
    margin: 0,
    color: "#111827",
    fontSize: 16,
    fontWeight: 950,
  },
  darkTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 950,
  },
  field: {
    display: "grid",
    gap: 5,
  },
  lightLabel: {
    color: "#334155",
    fontSize: 12,
    fontWeight: 950,
  },
  darkLabel: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 950,
  },
  input: {
    width: "100%",
    minHeight: 42,
    padding: "10px 11px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 14,
    boxSizing: "border-box",
  },
};
