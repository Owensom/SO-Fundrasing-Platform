import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import {
  getRaffleById,
  updateRaffle,
} from "../../../../../../api/_lib/raffles-repo";

type RouteContext = {
  params: {
    id: string;
  };
};

type Offer = {
  id?: string;
  label: string;
  price: number;
  quantity?: number;
  tickets?: number;
  is_active?: boolean;
  sort_order?: number;
};

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseColours(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function normalizeOffers(input: unknown): Offer[] {
  if (!Array.isArray(input)) return [];

  const result: Offer[] = [];

  input.forEach((item, index) => {
    if (!item || typeof item !== "object") return;

    const raw: any = item;

    const label = String(raw.label ?? "").trim();
    const quantity = toNumber(raw.quantity ?? raw.tickets ?? 0);

    const price =
      raw.price != null
        ? toNumber(raw.price)
        : raw.price_cents != null
          ? toNumber(raw.price_cents) / 100
          : 0;

    const isActive =
      raw.is_active === true ||
      raw.isActive === true ||
      raw.active === true;

    const sortOrder = toNumber(raw.sort_order ?? raw.sortOrder ?? index);

    if (!label || quantity <= 0 || price <= 0) return;

    result.push({
      id: raw.id || `offer-${index}`,
      label,
      price,
      quantity,
      tickets: quantity,
      is_active: isActive,
      sort_order: sortOrder,
    });
  });

  return result;
}

function parseOffers(value: string): Offer[] {
  if (!value.trim()) return [];

  try {
    return normalizeOffers(JSON.parse(value));
  } catch {
    return [];
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* =========================
   GET
========================= */
export async function GET(request: NextRequest, context: RouteContext) {
  const tenantSlug = getTenantSlugFromRequest(request);
  const id = context.params.id;

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 }
    );
  }

  const raffle = await getRaffleById(id);

  if (!raffle) {
    return NextResponse.json(
      { ok: false, error: "Raffle not found" },
      { status: 404 }
    );
  }

  if (raffle.tenant_slug !== tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, item: raffle });
}

/* =========================
   POST (FORM SAVE)
========================= */
export async function POST(request: NextRequest, context: RouteContext) {
  const tenantSlug = getTenantSlugFromRequest(request);
  const id = context.params.id;

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 }
    );
  }

  const existing = await getRaffleById(id);

  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "Raffle not found" },
      { status: 404 }
    );
  }

  if (existing.tenant_slug !== tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  const formData = await request.formData();

  const title = String(formData.get("title") ?? existing.title);
  const slug = slugify(String(formData.get("slug") ?? existing.slug));
  const description = String(formData.get("description") ?? "");
  const image_url = String(formData.get("image_url") ?? "");
  const currency = String(formData.get("currency") ?? existing.currency);
  const status = String(formData.get("status") ?? existing.status);

  const ticket_price = toNumber(
    formData.get("ticket_price"),
    existing.ticket_price
  );

  const startNumber = toNumber(formData.get("startNumber"), 1);
  const endNumber = toNumber(formData.get("endNumber"), 1);

  const colours = parseColours(String(formData.get("colours") ?? ""));
  const offers = parseOffers(String(formData.get("offers") ?? "[]"));

  const numbersPerColour =
    colours.length > 0 && endNumber >= startNumber
      ? endNumber - startNumber + 1
      : 0;

  const colourCount = colours.length;
  const total_tickets = numbersPerColour * colourCount;

  const updated = await updateRaffle(id, {
    tenant_slug: tenantSlug,
    title,
    slug,
    description,
    image_url,
    currency,
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
    sold: (existing.config_json?.sold ?? []) as any,
    reserved: (existing.config_json?.reserved ?? []) as any,
  });

  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "Update failed" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(
    new URL(`/admin/raffles/${id}`, request.url),
    { status: 303 }
  );
}
