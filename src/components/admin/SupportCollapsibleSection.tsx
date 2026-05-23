// src/components/admin/SupportCollapsibleSection.tsx
// ===============================
// Reusable admin collapsible section
// Uses native details/summary so the page can stay server-rendered
// ===============================

import type { CSSProperties, ReactNode } from "react";

export default function SupportCollapsibleSection({
  eyebrow,
  title,
  text,
  children,
  defaultOpen = false,
  tone = "blue",
}: {
  eyebrow: string;
  title: string;
  text?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  tone?: "blue" | "gold";
}) {
  const isGold = tone === "gold";

  return (
    <details
      className="support-collapsible-section"
      open={defaultOpen}
      style={{
        ...styles.details,
        ...(isGold ? styles.detailsGold : styles.detailsBlue),
      }}
    >
      <summary style={styles.summary}>
        <div style={styles.summaryText}>
          <p
            style={{
              ...styles.eyebrow,
              ...(isGold ? styles.eyebrowGold : styles.eyebrowBlue),
            }}
          >
            {eyebrow}
          </p>

          <h2 className="so-brand-card-title" style={styles.title}>
            {title}
          </h2>

          {text ? <p style={styles.text}>{text}</p> : null}
        </div>

        <span
          className="support-collapsible-icon"
          aria-hidden="true"
          style={{
            ...styles.icon,
            ...(isGold ? styles.iconGold : styles.iconBlue),
          }}
        >
          ↓
        </span>
      </summary>

      <div style={styles.content}>{children}</div>
    </details>
  );
}

const styles: Record<string, CSSProperties> = {
  details: {
    borderRadius: 28,
    padding: 0,
    overflow: "hidden",
    boxShadow: "0 8px 30px rgba(15,23,42,0.04)",
    marginBottom: 18,
  },

  detailsBlue: {
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(255,255,255,1) 72%)",
    border: "1px solid #bfdbfe",
  },

  detailsGold: {
    background:
      "linear-gradient(135deg, rgba(251,191,36,0.12), rgba(255,255,255,1) 72%)",
    border: "1px solid #fde68a",
  },

  summary: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 16,
    alignItems: "center",
    padding: 22,
    cursor: "pointer",
    listStyle: "none",
  },

  summaryText: {
    display: "grid",
    gap: 6,
    minWidth: 0,
  },

  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  eyebrowBlue: {
    color: "#2563eb",
  },

  eyebrowGold: {
    color: "#b45309",
  },

  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: 30,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  text: {
    margin: "2px 0 0",
    color: "#475569",
    lineHeight: 1.6,
    maxWidth: 980,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  icon: {
    width: 42,
    height: 42,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    fontWeight: 950,
    lineHeight: 1,
    flexShrink: 0,
  },

  iconBlue: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
  },

  iconGold: {
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
  },

  content: {
    padding: "0 22px 22px",
  },
};
