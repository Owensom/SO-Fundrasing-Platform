import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { headers, cookies } from "next/headers";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import RaffleAdminActions from "./RaffleAdminActions";
import PrizeSettings from "./PrizeSettings";

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
  config_json?: any;
  created_at: string;
  updated_at: string;
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
    headers: { cookie: cookieHeader },
  });

  const data = await res.json();

  if (!res.ok || !data?.ok) return null;

  return data.item ?? data.raffle ?? null;
}

export default async function AdminRaffleDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();

  if (!session?.user) redirect("/admin/login");

  const tenantSlug = await getTenantSlugFromHeaders();

  const raffle = await getRaffle(params.id);

  if (!raffle) {
    return <div style={{ padding: 40 }}>Raffle not found</div>;
  }

  const config = raffle.config_json || {};

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 16 }}>
      <Link href="/admin/raffles">← Back</Link>

      <h1 style={{ marginTop: 10 }}>{raffle.title}</h1>

      <p style={{ color: "#666" }}>
        /r/{raffle.slug} • {tenantSlug}
      </p>

      {/* ✅ ADMIN ACTIONS */}
      <RaffleAdminActions raffleId={raffle.id} status={raffle.status} />

      {/* ✅ STATS */}
      <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
        <div>
          <strong>Price:</strong> {raffle.ticket_price} {raffle.currency}
        </div>
        <div>
          <strong>Total:</strong> {raffle.total_tickets}
        </div>
        <div>
          <strong>Sold:</strong> {raffle.sold_tickets}
        </div>
        <div>
          <strong>Remaining:</strong> {raffle.remaining_tickets}
        </div>
      </div>

      {/* ✅ DESCRIPTION */}
      <div style={{ marginTop: 20 }}>
        <strong>Description</strong>
        <p>{raffle.description || "No description"}</p>
      </div>

      {/* ✅ IMAGE */}
      {raffle.image_url && (
        <img
          src={raffle.image_url}
          style={{ width: "100%", marginTop: 20, borderRadius: 12 }}
        />
      )}

      {/* ✅ OFFERS DISPLAY */}
      {Array.isArray(config.offers) && (
        <div style={{ marginTop: 30 }}>
          <h2>Offers</h2>
          {config.offers.map((o: any, i: number) => (
            <div key={i}>
              {o.label} — {o.price} ({o.quantity} tickets)
            </div>
          ))}
        </div>
      )}

      {/* ✅ COLOURS DISPLAY */}
      {Array.isArray(config.colours) && (
        <div style={{ marginTop: 30 }}>
          <h2>Colours</h2>
          {config.colours.map((c: any, i: number) => (
            <div key={i}>
              {c.name} ({c.hex})
            </div>
          ))}
        </div>
      )}

      {/* ✅ PRIZES */}
      <PrizeSettings
        raffleId={raffle.id}
        initialPrizes={config.prizes || []}
      />

      {/* LINKS */}
      <div style={{ marginTop: 30, display: "flex", gap: 16 }}>
        <Link href={`/r/${raffle.slug}`}>View public page</Link>
      </div>
    </main>
  );
}
