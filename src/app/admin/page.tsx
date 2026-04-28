import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

export default async function AdminHomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlug = await getTenantSlugFromHeaders();
  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>SO Foundation Platform</p>
          <h1 style={styles.title}>Admin Dashboard</h1>
          <p style={styles.subtle}>
            Tenant: <strong>{tenantSlug}</strong>
          </p>
          <p style={styles.subtle}>
            Signed in as <strong>{session.user.email}</strong>
          </p>
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/admin/login" });
          }}
        >
          <button style={styles.signOut}>Sign out</button>
        </form>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Fundraising tools</h2>

        <div style={styles.grid}>
          <Link href="/admin/raffles" style={styles.card}>
            <div style={styles.cardIcon}>🎟</div>
            <div style={styles.cardTitle}>Manage Raffles</div>
            <div style={styles.cardDesc}>
              View, edit, draw winners and manage ticket campaigns.
            </div>
          </Link>

          <Link href="/admin/raffles/new" style={styles.card}>
            <div style={styles.cardIcon}>➕</div>
            <div style={styles.cardTitle}>Create Raffle</div>
            <div style={styles.cardDesc}>
              Launch a new raffle with prizes, colours and offers.
            </div>
          </Link>

          <Link href="/admin/squares" style={styles.card}>
            <div style={styles.cardIcon}>🔲</div>
            <div style={styles.cardTitle}>Manage Squares</div>
            <div style={styles.cardDesc}>
              View, edit, draw winners and manage squares games.
            </div>
          </Link>

          <Link href="/admin/squares/new" style={styles.card}>
            <div style={styles.cardIcon}>➕</div>
            <div style={styles.cardTitle}>Create Squares Game</div>
            <div style={styles.cardDesc}>
              Launch a new squares game with draw date, image and prizes.
            </div>
          </Link>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Platform</h2>

        <div style={styles.grid}>
          <Link href="/admin/revenue" style={styles.card}>
            <div style={styles.cardIcon}>💰</div>
            <div style={styles.cardTitle}>Revenue & Fees</div>
            <div style={styles.cardDesc}>
              View sales, platform fees and payout information.
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: 16,
  },
  hero: {
    maxWidth: 1100,
    margin: "24px auto 16px",
    padding: 24,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 2px 14px rgba(15,23,42,0.08)",
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#2563eb",
    fontWeight: 900,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  title: {
    margin: 0,
    fontSize: "clamp(30px, 6vw, 44px)",
    fontWeight: 950,
    lineHeight: 1.05,
    color: "#0f172a",
  },
  subtle: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
  },
  section: {
    maxWidth: 1100,
    margin: "0 auto 16px",
    padding: 20,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 2px 14px rgba(15,23,42,0.08)",
  },
  sectionTitle: {
    margin: "0 0 14px",
    fontSize: 24,
    color: "#0f172a",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
  },
  card: {
    display: "block",
    padding: 18,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    textDecoration: "none",
    color: "#111827",
  },
  cardIcon: {
    fontSize: 28,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 900,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 1.45,
  },
  signOut: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #111827",
    background: "#111827",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
