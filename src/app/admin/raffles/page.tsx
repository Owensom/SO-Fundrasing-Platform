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

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Manage raffles</h1>
          <p style={{ margin: "8px 0 0" }}>
            Tenant: <strong>{tenantSlug}</strong>
          </p>
        </div>

        <Link
          href="/admin/raffles/new"
          style={{
            display: "inline-block",
            padding: "12px 18px",
            borderRadius: 9999,
            background: "#1683f8",
            color: "#fff",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Create raffle
        </Link>
      </div>

      {raffles.length === 0 ? (
        <div
          style={{
            padding: 24,
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            background: "#fff",
          }}
        >
          No raffles yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {raffles.map((raffle) => (
            <div
              key={raffle.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 20,
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <h2 style={{ margin: 0 }}>{raffle.title}</h2>
                  <p style={{ margin: "8px 0 0", color: "#4b5563" }}>
                    /r/{raffle.slug}
                  </p>
                </div>

                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 9999,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    textTransform: "capitalize",
                  }}
                >
                  {raffle.status}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                  gap: 12,
                  marginTop: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Price</div>
                  <div>
                    {raffle.ticket_price} {raffle.currency}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Draw date
                  </div>
                  <div>{formatDrawDate(raffle.draw_at)}</div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Total</div>
                  <div>{raffle.total_tickets}</div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Sold</div>
                  <div>{raffle.sold_tickets}</div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Remaining
                  </div>
                  <div>{raffle.remaining_tickets}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
                <Link href={`/r/${raffle.slug}`}>View public page</Link>
                <Link href={`/admin/raffles/${raffle.id}`}>Open details</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
