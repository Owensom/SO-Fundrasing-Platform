import { useMemo } from "react";

type AdminUser = {
  id: string;
  email: string;
  tenantSlug: string;
  role: "admin";
};

export default function AdminPage() {
  const user: AdminUser | null = useMemo(() => {
    return {
      id: "admin_demo_a",
      email: "admin@demo-a.com",
      tenantSlug: "demo-a",
      role: "admin",
    };
  }, []);

  const tenantSlug = user?.tenantSlug ?? "demo-a";
  const userEmail = user?.email ?? "Unknown admin";

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <section style={styles.heroCard}>
          <p style={styles.eyebrow}>Admin</p>
          <h1 style={styles.title}>Raffle Admin</h1>
          <p style={styles.description}>
            This page is now narrowed to the raffle module only so the app stays
            clean and build-safe while you finish the public raffle purchase
            flow.
          </p>

          <div style={styles.metaGrid}>
            <MetaCard label="Signed in as" value={userEmail} />
            <MetaCard label="Tenant" value={tenantSlug} />
            <MetaCard label="Role" value={user?.role ?? "admin"} />
            <MetaCard label="Module" value="Raffles" />
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Current admin actions</h2>

          <div style={styles.linkList}>
            <a
              href="/admin/raffles/spring-cash-raffle"
              style={styles.primaryLink}
            >
              Open raffle details
            </a>

            <a
              href="/raffles/spring-cash-raffle"
              style={styles.secondaryLink}
            >
              Open public raffle page
            </a>
          </div>

          <p style={styles.note}>
            This page is intentionally simple for now. It avoids nullable auth
            issues, keeps the raffle workflow moving, and leaves room for future
            tickets and squares modules without forcing premature abstractions.
          </p>
        </section>
      </div>
    </main>
  );
}

function MetaCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.metaCard}>
      <div style={styles.metaLabel}>{label}</div>
      <div style={styles.metaValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f6f7fb",
    padding: "32px 16px",
  },
  container: {
    maxWidth: 1100,
    margin: "0 auto",
    display: "grid",
    gap: 24,
  },
  heroCard: {
    background: "#ffffff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.06)",
  },
  card: {
    background: "#ffffff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.06)",
  },
  eyebrow: {
    margin: 0,
    color: "#64748b",
    fontSize: 14,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  title: {
    margin: "8px 0 12px",
    fontSize: 34,
    lineHeight: 1.1,
  },
  description: {
    margin: 0,
    color: "#334155",
    lineHeight: 1.6,
    maxWidth: 800,
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: 16,
    fontSize: 24,
  },
  metaGrid: {
    marginTop: 20,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  metaCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
  },
  metaLabel: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 8,
  },
  metaValue: {
    fontSize: 20,
    fontWeight: 700,
    color: "#111827",
    wordBreak: "break-word",
  },
  linkList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
  },
  primaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    borderRadius: 10,
    padding: "12px 16px",
    background: "#111827",
    color: "#ffffff",
    fontWeight: 700,
  },
  secondaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    borderRadius: 10,
    padding: "12px 16px",
    background: "#e5e7eb",
    color: "#111827",
    fontWeight: 700,
  },
  note: {
    marginTop: 16,
    marginBottom: 0,
    color: "#475569",
    lineHeight: 1.6,
  },
};
