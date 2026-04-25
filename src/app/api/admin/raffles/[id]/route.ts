import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import { getRaffleById, updateRaffle } from "../../../../../../api/_lib/raffles-repo";

// --- types ---
export type NormalizedOffer = {
  id?: string;
  label: string;
  quantity: number;
  price_cents: number;
  is_active: boolean;
  sort_order: number;
};

type RawOffer = {
  id?: string;
  label?: string;
  quantity?: number;
  tickets?: number;
  price?: number;
  price_cents?: number;
  is_active?: boolean;
  isActive?: boolean;
  sort_order?: number;
  sortOrder?: number;
};

// --- helper functions ---
function toFiniteNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizeOffers(input: unknown): NormalizedOffer[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item, index): NormalizedOffer | null => {
      if (!item || typeof item !== "object") return null;

      const raw = item as RawOffer;

      const label = typeof raw.label === "string" ? raw.label.trim() : "";
      const quantity = Math.floor(toFiniteNumber(raw.quantity ?? raw.tickets ?? 0));

      let price_cents = 0;
      if (raw.price_cents !== undefined) price_cents = Math.round(toFiniteNumber(raw.price_cents));
      else if (raw.price !== undefined) price_cents = Math.round(toFiniteNumber(raw.price) * 100);

      const is_active = raw.is_active === true || raw.isActive === true;
      const sort_order = Math.floor(toFiniteNumber(raw.sort_order ?? raw.sortOrder ?? index));

      if (!label || quantity <= 0 || price_cents <= 0) return null;

      return { id: raw.id, label, quantity, price_cents, is_active, sort_order };
    })
    .filter((o): o is NormalizedOffer => Boolean(o))
    .sort((a, b) => a.sort_order - b.sort_order);
}

// --- helpers ---
function parseColours(value: string): string[] {
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// --- main POST route ---
export async function POST(req: NextRequest, context: { params: { id: string } }) {
  const tenantSlug = getTenantSlugFromRequest(req);
  const id = context.params.id;

  if (!tenantSlug) return NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 });

  try {
    const existing = await getRaffleById(id);
    if (!existing) return NextResponse.json({ ok: false, error: "Raffle not found" }, { status: 404 });
    if (existing.tenant_slug !== tenantSlug) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

    const formData = await req.formData();
    const title = String(formData.get("title") ?? "").trim();
    const rawSlug = String(formData.get("slug") ?? "").trim();
    const slug = slugify(rawSlug || existing.slug);
    const description = String(formData.get("description") ?? "").trim();
    const image_url = String(formData.get("image_url") ?? "").trim();
    const currency = String(formData.get("currency") ?? existing.currency);
    const status = String(formData.get("status") ?? existing.status);
    const ticket_price = Number(formData.get("ticket_price") ?? existing.ticket_price);
    const startNumber = Number(formData.get("startNumber") ?? 0);
    const endNumber = Number(formData.get("endNumber") ?? 0);

    const colours = parseColours(String(formData.get("colours") ?? ""));
    const rawOffers = String(formData.get("offers") ?? "[]");
    const offers = normalizeOffers(JSON.parse(rawOffers));

    const numbersPerColour = colours.length > 0 && endNumber >= startNumber ? endNumber - startNumber + 1 : 0;
    const colourCount = colours.length;
    const total_tickets = numbersPerColour * colourCount;

    const updated = await updateRaffle(id, {
      tenant_slug: tenantSlug,
      title: title || existing.title,
      slug: slug || existing.slug,
      description,
      image_url,
      currency: currency as "GBP" | "USD" | "EUR",
      ticket_price,
      total_tickets,
      sold_tickets: existing.sold_tickets,
      status: status as "draft" | "published" | "closed" | "drawn",
      startNumber,
      endNumber,
      numbersPerColour,
      colourCount,
      colours,
      offers,
      sold: ((existing.config_json as any)?.sold ?? []) as Array<{ colour: string; number: number }>,
      reserved: ((existing.config_json as any)?.reserved ?? []) as Array<{ colour: string; number: number }>,
    });

    if (!updated) return NextResponse.json({ ok: false, error: "Update failed" }, { status: 500 });

    return NextResponse.redirect(new URL(`/admin/raffles/${id}`, req.url), { status: 303 });
  } catch (error) {
    console.error("POST raffle update failed:", error);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
