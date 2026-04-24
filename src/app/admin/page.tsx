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
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Admin Dashboard</h1>
          <p style={styles.subtle}>
            Tenant: <strong>{tenantSlug}</strong>
          </p>
          <p style={styles.subtle}>
            Signed in as <strong>{session.user.email}</strong>
          </p>
        </div>
      </div>

      <section style={styles.grid}>
        <Link href="/admin/raffles" style={styles.card}>
          <div style={styles.cardTitle}>🎟 Manage Raffles</div>
          <div style={styles.cardDesc}>
            View, edit, and manage your raffles
          </div>
        </Link>

        <Link href="/admin/raffles/new" style={styles.card}>
          <div style={styles.cardTitle}>➕ Create Raffle</div>
          <div style={styles.cardDesc}>
            Launch a new raffle campaign
          </div>
        </Link>

        <Link href="/admin/revenue" style={styles.card}>
          <div style={styles.cardTitle}>💰 Revenue & Fees</div>
          <div style={styles.cardDesc}>
            View sales, platform fees, and payouts
          </div>
        </Link>
      </section>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/admin/login" });
        }}
        style={{ marginTop: 32 }}
      >
        <button style={styles.signOut}>Sign out</button>
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 1000,
    margin: "40px auto",
    padding: "0 16px 48px",
    display: "grid",
    gap: 24,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: {
    margin: 0,
    fontSize: 32,
    fontWeight: 900,
    lineHeight: 1.1,
  },
  subtle: {
    margin: "6px 0 0",
    color: "#6b7280",
    fontSize: 14,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
  },
  card: {
    display: "block",
    padding: 20,
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    textDecoration: "none",
    color: "#111827",
    boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 800,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 14,
    color: "#6b7280",
  },
  signOut: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #111827",
    background: "#111827",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
};
