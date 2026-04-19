import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { headers, cookies } from "next/headers";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

type Offer = {
  id?: string;
  label: string;
  price: number;
  quantity?: number;
  tickets?: number;
  is_active?: boolean;
  isActive?: boolean;
  sort_order?: number;
  sortOrder?: number;
};

type ColourValue =
  | string
  | {
      id?: string;
      name?: string;
      hex?: string;
      sortOrder?: number;
    };

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
  config_json?: {
    startNumber?: number;
    endNumber?: number;
    numbersPerColour?: number;
    colourCount?: number;
    colours?: ColourValue[];
    offers?: Offer[];
    sold?: Array<{ colour: string; number: number }>;
    reserved?: Array<{ colour: string; number: number }>;
  };
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

function coloursToInput(colours: ColourValue[] | undefined): string {
  if (!Array.isArray(colours) || colours.length === 0) return "";

  return colours
    .map((colour) => {
      if (typeof colour === "string") return colour;
      if (colour?.name) return colour.name;
      if (colour?.hex) return colour.hex;
      if (colour?.id) return colour.id;
      return "";
    })
    .filter(Boolean)
    .join(",");
}

function offersToJson(offers: Offer[] | undefined): string {
  if (!Array.isArray(offers) || offers.length === 0) {
    return "[]";
  }

  return JSON.stringify(
    offers.map((offer) => ({
      id: offer.id,
      label: offer.label,
      price: offer.price,
      quantity: offer.quantity ?? offer.tickets ?? 0,
      is_active: offer.is_active ?? offer.isActive ?? true,
      sort_order: offer.sort_order ?? offer.sortOrder ?? 0,
    })),
    null,
    2,
  );
}

export default async function EditRafflePage({
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

  const config = raffle.config_json ?? {};

  return (
    <main style={{ maxWidth: 960, margin: "40px auto", padding: "0 16px" }}>
      <h1>Edit raffle</h1>

      <p>
        Tenant: <strong>{tenantSlug}</strong>
      </p>

      <form
        action={`/api/admin/raffles/${raffle.id}`}
        method="post"
        style={{ display: "grid", gap: 12, marginTop: 24, maxWidth: 720 }}
      >
        <label>
          <div style={{ marginBottom: 6 }}>Title</div>
          <input
            name="title"
            required
            defaultValue={raffle.title}
            style={{ width: "100%", padding: 12 }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>Slug</div>
          <input
            name="slug"
            required
            defaultValue={raffle.slug}
            style={{ width: "100%", padding: 12 }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>Description</div>
          <textarea
            name="description"
            rows={4}
            defaultValue={raffle.description}
            style={{ width: "100%", padding: 12 }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>Image URL</div>
          <input
            name="image_url"
            defaultValue={raffle.image_url}
            style={{ width: "100%", padding: 12 }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>Currency</div>
          <select
            name="currency"
            defaultValue={raffle.currency}
            style={{ width: "100%", padding: 12 }}
          >
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="USD">USD</option>
          </select>
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>Single ticket price</div>
          <input
            name="ticket_price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={raffle.ticket_price}
            style={{ width: "100%", padding: 12 }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>Total tickets</div>
          <input
            name="total_tickets"
            type="number"
            min="0"
            step="1"
            defaultValue={raffle.total_tickets}
            style={{ width: "100%", padding: 12 }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>Start number</div>
          <input
            name="startNumber"
            type="number"
            min="0"
            step="1"
            defaultValue={Number(config.startNumber ?? 0)}
            style={{ width: "100%", padding: 12 }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>End number</div>
          <input
            name="endNumber"
            type="number"
            min="0"
            step="1"
            defaultValue={Number(config.endNumber ?? 0)}
            style={{ width: "100%", padding: 12 }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>Colours (comma separated)</div>
          <input
            name="colours"
            defaultValue={coloursToInput(config.colours)}
            style={{ width: "100%", padding: 12 }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>Offers JSON</div>
          <textarea
            name="offers"
            rows={8}
            defaultValue={offersToJson(config.offers)}
            style={{ width: "100%", padding: 12, fontFamily: "monospace" }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>Status</div>
          <select
            name="status"
            defaultValue={raffle.status}
            style={{ width: "100%", padding: 12 }}
          >
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="closed">closed</option>
          </select>
        </label>

        <button
          type="submit"
          style={{
            width: "100%",
            padding: 14,
            border: "none",
            borderRadius: 9999,
            background: "#1683f8",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Save changes
        </button>
      </form>
    </main>
  );
}
