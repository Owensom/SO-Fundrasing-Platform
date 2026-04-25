import { NextRequest, NextResponse } from "next/server";
import { getRaffleById, updateRaffle } from "@/lib/raffles";
import { getTenantSlugFromRequest } from "@/lib/tenant";

type OfferInput = {
  id?: string;
  label?: string;
  price?: number;
  price_cents?: number;
  quantity?: number;
  tickets?: number;
  is_active?: boolean;
  isActive?: boolean;
  sort_order?: number;
  sortOrder?: number;
  active?: boolean;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseColours(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeOffers(value: unknown) {
  if (!Array.isArray(value)) return [];

  const offers: {
    id?: string;
    label: string;
    price: number;
    quantity: number;
    tickets: number;
    is_active: boolean;
    sort_order: number;
  }[] = [];

  value.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const raw = item as OfferInput;

    const label = String(raw.label ?? "").trim();
    const quantity = parseNumber(raw.quantity ?? raw.tickets ?? 0);
    let price = 0;

    if (raw.price != null) price = parseNumber(raw.price);
    else if (raw.price_cents != null) price = parseNumber(raw.price_cents) / 100;

    const isActive = raw.is_active === true || raw.isActive === true || raw.active === true;
    const sortOrder = parseNumber(raw.sort_order ?? raw.sortOrder ?? index);

    if (!label || quantity <= 0 || price <= 0) return;

    offers.push({
      id: raw.id || `offer-${index}`,
      label,
      price,
      quantity,
      tickets: quantity,
      is_active: isActive,
      sort_order: sortOrder,
    });
  });

  return offers;
}

type RouteContext = { params: { id: string } };

export async function GET(request: NextRequest, context: RouteContext) {
  const tenantSlug = getTenantSlugFromRequest(request);
  const id = context.params.id;

  if (!tenantSlug) {
    return NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 });
  }

  const raffle = await getRaffleById(id);
  if (!raffle) {
    return NextResponse.json({ ok: false, error: "Raffle not found" }, { status: 404 });
  }

  if (raffle.tenant_slug !== tenantSlug) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ok: true, item: raffle });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const tenantSlug = getTenantSlugFromRequest(request);
  const id = context.params.id;

  if (!tenantSlug) {
    return NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 });
  }

  const existing = await getRaffleById(id);
  if (!existing) return NextResponse.json({ ok: false, error: "Raffle not found" }, { status: 404 });
  if (existing.tenant_slug !== tenantSlug)
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const formData = await request.formData();

  const title = String(formData.get("title") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? existing.slug));
  const description = String(formData.get("description") ?? "");
  const image_url = String(formData.get("image_url") ?? "");
  const ticket_price = parseNumber(formData.get("ticket_price"), existing.ticket_price);
  const status = String(formData.get("status") ?? existing.status);

  const colours = parseColours(String(formData.get("colours") ?? ""));
  const offersRaw = String(formData.get("offers") ?? "[]");
  const offers = normalizeOffers(JSON.parse(offersRaw));

  const startNumber = parseNumber(formData.get("startNumber"), 1);
  const endNumber = parseNumber(formData.get("endNumber"), 1);

  const numbersPerColour = colours.length > 0 && endNumber >= startNumber ? endNumber - startNumber + 1 : 0;
  const colourCount = colours.length;
  const total_tickets = numbersPerColour * colourCount;

  const updated = await updateRaffle(id, {
    tenant_slug: tenantSlug,
    title,
    slug,
    description,
    image_url,
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
    sold: (existing.config_json?.sold as Array<{ colour: string; number: number }>) ?? [],
    reserved: (existing.config_json?.reserved as Array<{ colour: string; number: number }>) ?? [],
  });

  if (!updated) {
    return NextResponse.json({ ok: false, error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item: updated });
}
