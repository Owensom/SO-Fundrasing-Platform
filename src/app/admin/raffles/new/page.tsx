import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import NewRaffleForm from "@/components/admin/NewRaffleForm";

export default async function NewRafflePage() {
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
        <div style={styles.heroContent}>
          <div style={styles.badge}>SO Foundation Platform</div>

          <h1 style={styles.title}>Create raffle</h1>

          <p style={styles.subtitle}>
            Build a premium raffle campaign with ticket pricing, offers, prize
            management, legal entry settings and live draw tools.
          </p>

          <div style={styles.tenantRow}>
            Tenant:{" "}
            <strong style={{ color: "#ffffff" }}>{tenantSlug}</strong>
          </div>
        </div>

        <div style={styles.heroImageWrap}>
          <img
            src="/brand/so-default-raffles.png"
            alt="SO Raffles"
            style={styles.heroImage}
          />
        </div>
      </section>

      <section style={styles.topBar}>
        <Link href="/admin/raffles" style={styles.secondaryButton}>
          ← Back to raffles
        </Link>

        <Link href="/admin" style={styles.primaryButton}>
          Dashboard
        </Link>
      </section>

      <section style={styles.formCard}>
        <NewRaffleForm tenantSlug={tenantSlug} />
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "24px 16px 64px",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 28%), #f8fafc",
    minHeight: "100vh",
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) 320px",
    gap: 24,
    alignItems: "center",
    padding: 28,
    borderRadius: 32,
    background:
      "linear-gradient(135deg, #08142f 0%, #0f1f46 55%, #1e293b 100%)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 24px 60px rgba(15,23,42,0.18)",
    marginBottom: 20,
    overflow: "hidden",
    flexWrap: "wrap",
  },

  heroContent: {
    minWidth: 0,
  },

  badge: {
    display: "inline-flex",
    padding: "7px 12px",
    borderRadius: 999,
    background: "rgba(212,175,87,0.14)",
    color: "#f8d878",
    border: "1px solid rgba(212,175,87,0.24)",
    fontSize: 13,
    fontWeight: 900,
    marginBottom: 16,
  },

  title: {
    margin: 0,
    color: "#ffffff",
    fontSize: "clamp(34px, 8vw, 64px)",
    lineHeight: 0.95,
    letterSpacing: "-0.06em",
    wordBreak: "break-word",
  },

  subtitle: {
    margin: "16px 0 0",
    color: "rgba(255,255,255,0.74)",
    fontSize: 16,
    lineHeight: 1.7,
    maxWidth: 760,
  },

  tenantRow: {
    marginTop: 16,
    color: "rgba(255,255,255,0.82)",
    fontWeight: 800,
    fontSize: 15,
    wordBreak: "break-word",
  },

  heroImageWrap: {
    width: "100%",
    maxWidth: 320,
    aspectRatio: "1 / 1",
    borderRadius: 28,
    overflow: "hidden",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 100%)",
    border: "1px solid rgba(255,255,255,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    justifySelf: "center",
    padding: 18,
    boxSizing: "border-box",
  },

  heroImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
  },

  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 20,
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 18px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    textDecoration: "none",
    fontWeight: 900,
    boxShadow: "0 10px 24px rgba(15,23,42,0.16)",
    whiteSpace: "nowrap",
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 18px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 900,
    boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
    whiteSpace: "nowrap",
  },

  formCard: {
    borderRadius: 30,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 18px 44px rgba(15,23,42,0.06)",
    padding: 20,
    overflow: "hidden",
  },
};
