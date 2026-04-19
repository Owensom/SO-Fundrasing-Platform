import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { headers, cookies } from "next/headers";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

type RaffleDetails = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string;
  image_url: string;
  currency: string;
  ticket_price: number;
  total_tickets: number;
  sold_tickets: number;
  remaining_tickets: number;
  status: string;
  config_json?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type ApiResponse = {
  ok: boolean;
  item?: RaffleDetails;
  raffle?: RaffleDetails;
  error?: string;
};

async function getRaffle(id: string): Promise<RaffleDetails | null> {
  const headerStore = headers();
  const cookieStore = cookies();

  const host = headerStore.get("host") || "";
  const protocol = host.includes("localhost") ? "http" : "https";
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  const res = await fetch(`${protocol}://${host}/api/admin/raffles/${id}`, {
    cache: "no-store",
    headers: {
      cookie: cookieHeader,
    },
  });

  const data = (await res.json()) as ApiResponse;

  if (!res.ok || !data.ok) {
    return null;
  }

  return data.item ?? data.raffle ?? null;
}

export default async function AdminRaffleDetailsPage({
  params,
}: {
  params: { id: string };
}) {
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

  const raffle = await getRaffle(params.id);

  if (!raffle) {
    notFound();
  }

  if (raffle.tenant_slug !== tenantSlug) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  return (
    <main style={{ maxWidth: 960, margin: "40px auto", padding: "0 16px" }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/admin/raffles">← Back to raffles</Link>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#fff",
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            marginBottom: 20,
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>{raffle.title}</h1>
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
            }}
          >
            {raffle.status}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Tenant</div>
            <div>{raffle.tenant_slug}</div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Price</div>
            <div>
              {raffle.ticket_price} {raffle.currency}
            </div>
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
            <div style={{ fontSize: 12, color: "#6b7280" }}>Remaining</div>
            <div>{raffle.remaining_tickets}</div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Created</div>
            <div>{new Date(raffle.created_at).toLocaleString()}</div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Updated</div>
            <div>{new Date(raffle.updated_at).toLocaleString()}</div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
            Description
          </div>
          <div>{raffle.description || "No description"}</div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
            Image URL
          </div>
          <div>{raffle.image_url || "No image"}</div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
            Config JSON
          </div>
          <pre
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 16,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {JSON.stringify(raffle.config_json ?? {}, null, 2)}
          </pre>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          <Link href={`/r/${raffle.slug}`}>View public page</Link>
        </div>
      </div>
    </main>
  );
}
