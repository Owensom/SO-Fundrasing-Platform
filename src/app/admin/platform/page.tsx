// src/app/admin/platform/page.tsx
// ===============================
// Platform Owner Tools Hub
// Lightweight navigation hub for platform-owner-only tools
// No database writes, no checkout changes, no public flow changes
// ===============================

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PlatformSession = {
  user?: {
    email?: unknown;
    name?: unknown;
    isPlatformOwner?: unknown;
  } | null;
} | null;

async function requirePlatformOwner() {
  const session = (await auth()) as PlatformSession;

  if (!session?.user) {
    redirect("/admin/login");
  }

  if (!Boolean(session.user.isPlatformOwner)) {
    redirect("/admin?error=platform_owner_required");
  }

  return session;
}

function cleanText(value: unknown, fallback = "Platform owner") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

export default async function PlatformOwnerHubPage() {
  const session = await requirePlatformOwner();

  const ownerName = cleanText(session.user?.name);
  const ownerEmail = cleanText(session.user?.email, "Not recorded");

  return (
    <main className="platform-hub-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="platform-hub-hero" style={styles.hero}>
        <div style={styles.heroContent}>
          <Link href="/admin" style={styles.backLink}>
            ← Back to admin dashboard
          </Link>

          <div style={styles.badgeRow}>
            <span style={styles.badge}>Platform owner</span>
            <span style={styles.softBadge}>Tools hub</span>
          </div>

          <h1 className="so-brand-heading platform-hub-title" style={styles.title}>
            Platform tools
          </h1>

          <p style={styles.subtitle}>
            A focused owner-only hub for support, incidents, platform billing
            and tenant checks.
          </p>
        </div>

        <div className="platform-owner-card" style={styles.ownerCard}>
          <p style={styles.ownerKicker}>Signed in as</p>

          <h2 style={styles.ownerName}>{ownerName}</h2>

          <p style={styles.ownerEmail}>{ownerEmail}</p>

          <div style={styles.ownerNotice}>
            These tools are restricted to platform-owner accounts.
          </div>
        </div>
      </section>

      <section className="platform-hub-grid" style={styles.cardGrid}>
        <ToolCard
          eyebrow="Support"
          title="Support requests"
          text="Review tenant support requests, update status, add internal notes and reply to tenant admins."
          href="/admin/platform/support"
          action="Open support dashboard"
          tone="blue"
        />

        <ToolCard
          eyebrow="Status"
          title="Platform incidents"
          text="Manage platform incidents and public status updates for known issues, monitoring notes and resolved notices."
          href="/admin/platform/incidents"
          action="Open incidents"
          tone="gold"
        />

        <ToolCard
          eyebrow="Billing"
          title="Platform billing"
          text="Review tenant subscriptions, billing readiness, plan state and platform-level commercial settings."
          href="/admin/platform/billing"
          action="Open billing"
          tone="blue"
        />

        <ToolCard
          eyebrow="Tenant checks"
          title="Branding & contact checks"
          text="Use tenant branding settings to confirm public contact emails, test email delivery and review public contact setup."
          href="/admin/settings/branding"
          action="Open branding settings"
          tone="gold"
        />
      </section>

      <section className="platform-hub-secondary" style={styles.secondaryPanel}>
        <div>
          <p style={styles.kicker}>Quick checks</p>

          <h2 className="so-brand-card-title" style={styles.sectionTitle}>
            Useful owner workflows
          </h2>

          <p style={styles.sectionText}>
            These links keep the support/status/contact verification work easy
            to reach without changing any public or payment flows.
          </p>
        </div>

        <div className="platform-quick-grid" style={styles.quickGrid}>
          <QuickLink href="/admin/support">Tenant help page</QuickLink>
          <QuickLink href="/status">Public status page</QuickLink>
          <QuickLink href="/admin/donations">Donations & Gift Aid</QuickLink>
          <QuickLink href="/admin/metadata">Finance metadata</QuickLink>
          <QuickLink href="/admin/settings/billing">Tenant billing settings</QuickLink>
          <QuickLink href="/admin/settings/public-hub">Public hub settings</QuickLink>
        </div>
      </section>
    </main>
  );
}

function ToolCard({
  eyebrow,
  title,
  text,
  href,
  action,
  tone,
}: {
  eyebrow: string;
  title: string;
  text: string;
  href: string;
  action: string;
  tone: "blue" | "gold";
}) {
  const isGold = tone === "gold";

  return (
    <Link href={href} style={styles.cardLink}>
      <article
        className="platform-tool-card"
        style={{
          ...styles.toolCard,
          ...(isGold ? styles.toolCardGold : styles.toolCardBlue),
        }}
      >
        <div style={styles.toolCardContent}>
          <span
            style={{
              ...styles.toolEyebrow,
              ...(isGold ? styles.toolEyebrowGold : styles.toolEyebrowBlue),
            }}
          >
            {eyebrow}
          </span>

          <h2 className="so-brand-card-title" style={styles.toolTitle}>
            {title}
          </h2>

          <p style={styles.toolText}>{text}</p>
        </div>

        <div
          style={{
            ...styles.toolAction,
            ...(isGold ? styles.toolActionGold : styles.toolActionBlue),
          }}
        >
          {action} →
        </div>
      </article>
    </Link>
  );
}

function QuickLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} style={styles.quickLink}>
      {children} →
    </Link>
  );
}

const responsiveStyles = `
.platform-hub-page,
.platform-hub-page * {
  box-sizing: border-box;
}

.platform-hub-page {
  overflow-x: hidden;
}

.platform-hub-page section,
.platform-hub-page article,
.platform-hub-page div,
.platform-hub-page a,
.platform-hub-page p,
.platform-hub-page h1,
.platform-hub-page h2,
.platform-hub-page span,
.platform-hub-page strong {
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 980px) {
  .platform-hub-page .platform-hub-hero,
  .platform-hub-page .platform-hub-grid {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 720px) {
  .platform-hub-page {
    padding: 18px 12px 44px !important;
  }

  .platform-hub-page .platform-hub-hero,
  .platform-hub-page .platform-tool-card,
  .platform-hub-page .platform-hub-secondary {
    padding: 18px !important;
    border-radius: 24px !important;
  }

  .platform-hub-page .platform-hub-title {
    font-size: clamp(38px, 11vw, 58px) !important;
    line-height: 0.98 !important;
  }

  .platform-hub-page .platform-quick-grid {
    grid-template-columns: 1fr !important;
  }

  .platform-hub-page a,
  .platform-hub-page p,
  .platform-hub-page h1,
  .platform-hub-page h2,
  .platform-hub-page span,
  .platform-hub-page strong {
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1320,
    margin: "0 auto",
    padding: "28px 16px 64px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(37,99,235,0.10), transparent 30%), radial-gradient(circle at top right, rgba(251,191,36,0.10), transparent 34%), #f8fafc",
    color: "#0f172a",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(300px, 0.8fr)",
    gap: 22,
    padding: 30,
    borderRadius: 34,
    background:
      "radial-gradient(circle at bottom right, rgba(251,191,36,0.18), transparent 38%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 28px 70px rgba(15,23,42,0.22)",
    overflow: "hidden",
    border: "1px solid rgba(148,163,184,0.22)",
  },

  heroContent: {
    minWidth: 0,
  },

  backLink: {
    display: "inline-flex",
    width: "fit-content",
    maxWidth: "100%",
    marginBottom: 16,
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    lineHeight: 1.2,
  },

  badgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 14,
  },

  badge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(37,99,235,0.22)",
    color: "#dbeafe",
    border: "1px solid rgba(147,197,253,0.34)",
    fontSize: 13,
    fontWeight: 950,
  },

  softBadge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(251,191,36,0.16)",
    color: "#fef3c7",
    border: "1px solid rgba(251,191,36,0.32)",
    fontSize: 13,
    fontWeight: 950,
  },

  title: {
    margin: 0,
    fontSize: "clamp(52px, 7vw, 82px)",
    lineHeight: 0.92,
    letterSpacing: "-0.08em",
    color: "#ffffff",
    overflowWrap: "anywhere",
    textShadow: "0 18px 45px rgba(0,0,0,0.22)",
  },

  subtitle: {
    margin: "18px 0 0",
    maxWidth: 780,
    color: "#dbeafe",
    fontSize: 18,
    lineHeight: 1.6,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  ownerCard: {
    display: "grid",
    gap: 10,
    alignContent: "center",
    padding: 22,
    borderRadius: 28,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.28)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
    backdropFilter: "blur(12px)",
    overflow: "hidden",
  },

  ownerKicker: {
    margin: 0,
    color: "#facc15",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  ownerName: {
    margin: 0,
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 1.08,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  ownerEmail: {
    margin: 0,
    color: "#dbeafe",
    lineHeight: 1.5,
    fontWeight: 800,
    overflowWrap: "anywhere",
  },

  ownerNotice: {
    marginTop: 6,
    padding: 12,
    borderRadius: 16,
    background: "rgba(15,23,42,0.28)",
    border: "1px solid rgba(148,163,184,0.24)",
    color: "#bfdbfe",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 750,
  },

  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 14,
    marginBottom: 18,
  },

  cardLink: {
    color: "inherit",
    textDecoration: "none",
    display: "block",
    height: "100%",
    minWidth: 0,
  },

  toolCard: {
    display: "grid",
    gridTemplateRows: "1fr auto",
    gap: 16,
    height: "100%",
    minHeight: 245,
    padding: 20,
    borderRadius: 28,
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
    overflow: "hidden",
  },

  toolCardBlue: {
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(255,255,255,1) 72%)",
    border: "1px solid #bfdbfe",
  },

  toolCardGold: {
    background:
      "linear-gradient(135deg, rgba(251,191,36,0.12), rgba(255,255,255,1) 72%)",
    border: "1px solid #fde68a",
  },

  toolCardContent: {
    display: "grid",
    gap: 10,
    alignContent: "start",
  },

  toolEyebrow: {
    display: "inline-flex",
    width: "fit-content",
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  toolEyebrowBlue: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
  },

  toolEyebrowGold: {
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
  },

  toolTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 26,
    lineHeight: 1.1,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  toolText: {
    margin: 0,
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.55,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  toolAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "11px 14px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 950,
    textAlign: "center",
  },

  toolActionBlue: {
    background: "linear-gradient(135deg, #1683f8 0%, #2563eb 100%)",
    color: "#ffffff",
    border: "1px solid #1683f8",
  },

  toolActionGold: {
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
  },

  secondaryPanel: {
    display: "grid",
    gap: 16,
    padding: 22,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
    overflow: "hidden",
  },

  kicker: {
    margin: 0,
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  sectionTitle: {
    margin: "7px 0 0",
    color: "#0f172a",
    fontSize: 30,
    lineHeight: 1.08,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.6,
    maxWidth: 820,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  quickGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },

  quickLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 50,
    padding: "13px 14px",
    borderRadius: 18,
    background: "#f8fafc",
    color: "#0f172a",
    border: "1px solid #e2e8f0",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    lineHeight: 1.25,
    overflowWrap: "anywhere",
  },
};
