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
    <main
      style={{
        maxWidth: 1180,
        margin: "0 auto",
        padding: "32px 16px 56px",
        background: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      <section
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 22,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              padding: "6px 10px",
              borderRadius: 999,
              background: "#e0f2fe",
              color: "#0369a1",
              fontSize: 13,
              fontWeight: 800,
              marginBottom: 10,
            }}
          >
            Admin dashboard
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 34,
              lineHeight: 1.1,
              letterSpacing: "-0.04em",
              color: "#0f172a",
            }}
          >
            Manage raffles
          </h1>

          <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: 15 }}>
            Tenant: <strong style={{ color: "#0f172a" }}>{tenantSlug}</strong>
          </p>
        </div>

       <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
  <Link href="/admin" style={styles.topSecondaryLink}>
    ← Dashboard
  </Link>

<div style={styles.activeNav}>
  Raffles
</div>
         
  <Link href="/admin/squares" style={styles.topSecondaryLink}>
    Squares
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

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 22,
        }}
      >
        <StatCard label="Total raffles" value={totalRaffles} />
        <StatCard label="Published" value={publishedCount} />
        <StatCard label="Tickets sold" value={totalSold} />
        <StatCard label="Remaining" value={totalRemaining} />
      </section>

      {raffles.length === 0 ? (
        <section
          style={{
            padding: 28,
            border: "1px solid #e2e8f0",
            borderRadius: 22,
            background: "#fff",
            boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
          }}
        >
          <h2 style={{ margin: 0, color: "#0f172a" }}>No raffles yet</h2>

<p style={{ color: "#64748b", margin: "8px 0 18px" }}>
  Create your first raffle and publish it when ready.
</p>

<Link
  href="/admin/raffles/new"
  style={{
    display: "inline-flex",
    padding: "11px 16px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 800,
  }}
>
  Create raffle
</Link>
        </section>
      ) : (
        <section style={{ display: "grid", gap: 16 }}>
          {raffles.map((raffle) => {
            const progress = getProgressPercent(raffle);
            const statusStyle = getStatusStyle(raffle.status);

            return (
              <article
                key={raffle.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 22,
                  padding: 18,
                  background: "#fff",
                  boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "96px 1fr",
                    gap: 16,
                    alignItems: "start",
                  }}
                >
                  <div
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: 18,
                      overflow: "hidden",
                      background: "#f1f5f9",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    {raffle.image_url ? (
                      <img
                        src={raffle.image_url}
                        alt={raffle.title}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#94a3b8",
                          fontWeight: 900,
                          fontSize: 24,
                        }}
                      >
                        🎟️
                      </div>
                    )}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <h2
                          style={{
                            margin: 0,
                            fontSize: 22,
                            color: "#0f172a",
                            letterSpacing: "-0.02em",
                            wordBreak: "break-word",
                          }}
                        >
                          {raffle.title}
                        </h2>

                        <p
                          style={{
                            margin: "6px 0 0",
                            color: "#64748b",
                            fontSize: 14,
                            wordBreak: "break-word",
                          }}
                        >
                          /r/{raffle.slug}
                        </p>
                      </div>

                      <div
                        style={{
                          padding: "7px 11px",
                          borderRadius: 9999,
                          border: "1px solid",
                          fontSize: 13,
                          textTransform: "capitalize",
                          fontWeight: 800,
                          ...statusStyle,
                        }}
                      >
                        {raffle.status}
                      </div>
                    </div>

                    {raffle.description ? (
                      <p
                        style={{
                          color: "#475569",
                          fontSize: 14,
                          lineHeight: 1.5,
                          margin: "10px 0 0",
                        }}
                      >
                        {raffle.description.length > 130
                          ? `${raffle.description.slice(0, 130)}…`
                          : raffle.description}
                      </p>
                    ) : null}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(130px, 1fr))",
                        gap: 10,
                        marginTop: 16,
                      }}
                    >
                      <InfoBlock
                        label="Price"
                        value={formatCurrency(
                          raffle.ticket_price,
                          raffle.currency,
                        )}
                      />
                      <InfoBlock
                        label="Draw date"
                        value={formatDrawDate(raffle.draw_at)}
                      />
                      <InfoBlock label="Total" value={raffle.total_tickets} />
                      <InfoBlock label="Sold" value={raffle.sold_tickets} />
                      <InfoBlock
                        label="Remaining"
                        value={raffle.remaining_tickets}
                      />
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          color: "#64748b",
                          fontSize: 13,
                          fontWeight: 700,
                          marginBottom: 6,
                        }}
                      >
                        <span>Sales progress</span>
                        <span>{progress}%</span>
                      </div>

                      <div
                        style={{
                          height: 10,
                          borderRadius: 999,
                          background: "#e2e8f0",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${progress}%`,
                            background: "#16a34a",
                            borderRadius: 999,
                          }}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        marginTop: 18,
                        flexWrap: "wrap",
                      }}
                    >
                      <Link
                        href={`/admin/raffles/${raffle.id}`}
                        style={styles.primaryLink}
                      >
                        Open details
                      </Link>

                      <Link
                        href={`/r/${raffle.slug}?adminReturn=/admin/raffles/${raffle.id}`}
                        target="_blank"
                        style={styles.secondaryLink}
                      >
                        View campaign page
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
      }}
    >
      <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>
        {label}
      </div>
      <div
        style={{
          color: "#0f172a",
          fontSize: 28,
          fontWeight: 900,
          marginTop: 4,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          color: "#0f172a",
          fontWeight: 900,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  createLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 18px",
    borderRadius: 9999,
    background: "#1683f8",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 800,
    boxShadow: "0 10px 20px rgba(22,131,248,0.22)",
  },
  topSecondaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 18px",
    borderRadius: 9999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 800,
  },
  primaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
  },
  secondaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
  },
activeNav: {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "13px 18px",
  borderRadius: 9999,
  background: "#0f172a",
  color: "#ffffff",
  fontWeight: 900,
},
};
