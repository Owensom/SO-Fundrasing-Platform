import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { headers, cookies } from "next/headers";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

type RaffleItem = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string;
  image_url: string;
  draw_at: string | null;
  currency: string;
  ticket_price: number;
  total_tickets: number;
  sold_tickets: number;
  remaining_tickets: number;
  status: string;
  created_at: string;
  updated_at: string;
};

type ApiResponse = {
  ok: boolean;
  items?: RaffleItem[];
  error?: string;
};

async function getAdminRaffles(): Promise<RaffleItem[]> {
  const headerStore = headers();
  const cookieStore = cookies();

  const host = headerStore.get("host") || "";
  const protocol = host.includes("localhost") ? "http" : "https";
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  const res = await fetch(`${protocol}://${host}/api/admin/raffles`, {
    cache: "no-store",
    headers: {
      cookie: cookieHeader,
    },
  });

  const data = (await res.json()) as ApiResponse;

  if (!res.ok || !data.ok || !data.items) {
    return [];
  }

  return data.items;
}

function formatDrawDate(value: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency || "GBP"}`;
  }
}

function getStatusStyle(status: string): React.CSSProperties {
  const clean = status.toLowerCase();

  if (clean === "published") {
    return {
      background: "#ecfdf5",
      borderColor: "#bbf7d0",
      color: "#166534",
    };
  }

  if (clean === "closed") {
    return {
      background: "#fff7ed",
      borderColor: "#fed7aa",
      color: "#9a3412",
    };
  }

  if (clean === "drawn") {
    return {
      background: "#eff6ff",
      borderColor: "#bfdbfe",
      color: "#1d4ed8",
    };
  }

  return {
    background: "#f8fafc",
    borderColor: "#e2e8f0",
    color: "#475569",
  };
}

function getProgressPercent(raffle: RaffleItem) {
  if (!raffle.total_tickets || raffle.total_tickets <= 0) return 0;
  return Math.min(
    100,
    Math.max(0, Math.round((raffle.sold_tickets / raffle.total_tickets) * 100)),
  );
}

export default async function AdminRafflesPage() {
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

  const raffles = await getAdminRaffles();

  const totalRaffles = raffles.length;
  const publishedCount = raffles.filter((r) => r.status === "published").length;
  const totalSold = raffles.reduce(
    (sum, r) => sum + Number(r.sold_tickets || 0),
    0,
  );
  const totalRemaining = raffles.reduce(
    (sum, r) => sum + Number(r.remaining_tickets || 0),
    0,
  );

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div style={styles.badge}>Admin dashboard</div>

          <h1 style={styles.title}>Manage raffles</h1>

          <p style={styles.subtitle}>
            Tenant: <strong>{tenantSlug}</strong>
          </p>
        </div>

        <div style={styles.navRow}>
          <Link href="/admin" style={styles.topSecondaryLink}>
            ← Dashboard
          </Link>

          <div style={styles.activeNav}>Raffles</div>

          <Link href="/admin/squares" style={styles.topSecondaryLink}>
            Squares
          </Link>

          {/* ✅ NEW EVENTS BUTTON */}
          <Link href="/admin/events" style={styles.topSecondaryLink}>
            Events
          </Link>

          <Link
            href={`/c/${tenantSlug}?adminReturn=/admin/raffles`}
            style={styles.secondaryLink}
          >
            Public campaigns page
          </Link>

          <Link href="/admin/raffles/new" style={styles.createLink}>
            + Create raffle
          </Link>
        </div>
      </section>

      {/* rest of file unchanged */}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "32px 16px 56px",
    background: "#f8fafc",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
    gap: 16,
    flexWrap: "wrap",
  },
  navRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  badge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#e0f2fe",
    color: "#0369a1",
    fontSize: 13,
    fontWeight: 800,
    marginBottom: 10,
  },
  title: {
    margin: 0,
    fontSize: 34,
    color: "#0f172a",
  },
  subtitle: {
    margin: "10px 0 0",
    color: "#64748b",
  },
  createLink: {
    padding: "13px 18px",
    borderRadius: 9999,
    background: "#1683f8",
    color: "#fff",
    fontWeight: 800,
  },
  topSecondaryLink: {
    padding: "13px 18px",
    borderRadius: 9999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    fontWeight: 800,
  },
  secondaryLink: {
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid #cbd5e1",
  },
  activeNav: {
    padding: "13px 18px",
    borderRadius: 9999,
    background: "#0f172a",
    color: "#fff",
    fontWeight: 900,
  },
};
