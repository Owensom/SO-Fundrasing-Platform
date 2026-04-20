import Link from "next/link";
import { redirect } from "next/navigation";
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

async function getRaffle(id: string): Promise<{
  raffle: RaffleDetails | null;
  error?: string;
}> {
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

  let data: ApiResponse | null = null;

  try {
    data = (await res.json()) as ApiResponse;
  } catch {
    return {
      raffle: null,
      error: `Invalid JSON (${res.status})`,
    };
  }

  if (!res.ok || !data?.ok) {
    return {
      raffle: null,
      error: data?.error || `Request failed (${res.status})`,
    };
  }

  return {
    raffle: data.item ?? data.raffle ?? null,
  };
}

function statusBadgeStyle(status: string) {
  if (status === "published") {
    return {
      background: "#ecfdf5",
      border: "1px solid #86efac",
      color: "#166534",
    };
  }

  if (status === "draft") {
    return {
      background: "#fff7ed",
      border: "1px solid #fdba74",
      color: "#9a3412",
    };
  }

  return {
    background: "#f3f4f6",
    border: "1px solid #d1d5db",
    color: "#374151",
  };
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

  const { raffle, error } = await getRaffle(params.id);

  return (
    <main style={{ maxWidth: 960, margin: "40px auto", padding: "0 16px" }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/admin/raffles">← Back to raffles</Link>
      </div>

      {!raffle ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            background: "#fff",
            padding: 24,
          }}
        >
          <h1>Raffle details</h1>
          <p>Could not load raffle.</p>
          <p>
            ID: <strong>{params.id}</strong>
          </p>
          <p>
            Tenant: <strong>{tenantSlug}</strong>
          </p>
          <p>
            Error: <strong>{error || "Unknown error"}</strong>
          </p>
        </div>
      ) : (
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
              flexWrap: "wrap",
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
                fontSize: 14,
                ...statusBadgeStyle(raffle.status),
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
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Description
            </div>
            <div>{raffle.description || "No description"}</div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Config JSON
            </div>
            <pre
              style={{
                background: "#f9fafb",
                padding: 16,
                borderRadius: 12,
                overflowX: "auto",
              }}
            >
              {JSON.stringify(raffle.config_json ?? {}, null, 2)}
            </pre>
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Link href={`/r/${raffle.slug}`}>View public page</Link>
            <Link href={`/admin/raffles/${raffle.id}/edit`}>
              Edit raffle
            </Link>

            {raffle.status !== "published" ? (
              <form action={`/api/admin/raffles/${raffle.id}/status`} method="post">
                <input type="hidden" name="status" value="published" />
                <button
                  type="submit"
                  style={{
                    padding: "10px 14px",
                    borderRadius: 9999,
                    border: "1px solid #86efac",
                    background: "#ecfdf5",
                    color: "#166534",
                    cursor: "pointer",
                  }}
                >
                  Publish
                </button>
              </form>
            ) : null}

            {raffle.status !== "draft" ? (
              <form action={`/api/admin/raffles/${raffle.id}/status`} method="post">
                <input type="hidden" name="status" value="draft" />
                <button
                  type="submit"
                  style={{
                    padding: "10px 14px",
                    borderRadius: 9999,
                    border: "1px solid #fdba74",
                    background: "#fff7ed",
                    color: "#9a3412",
                    cursor: "pointer",
                  }}
                >
                  Move to draft
                </button>
              </form>
            ) : null}

            {raffle.status !== "closed" ? (
              <form action={`/api/admin/raffles/${raffle.id}/status`} method="post">
                <input type="hidden" name="status" value="closed" />
                <button
                  type="submit"
                  style={{
                    padding: "10px 14px",
                    borderRadius: 9999,
                    border: "1px solid #d1d5db",
                    background: "#f3f4f6",
                    color: "#374151",
                    cursor: "pointer",
                  }}
                >
                  Close raffle
                </button>
              </form>
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}
