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

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOffersFromForm(formData: FormData): Offer[] {
  const count = toNumber(formData.get("offer_count"), 0);
  const offers: Offer[] = [];

  for (let index = 0; index < count; index += 1) {
    const label = String(formData.get(`offer_label_${index}`) ?? "").trim();
    const quantity = toNumber(formData.get(`offer_quantity_${index}`), 0);
    const price = toNumber(formData.get(`offer_price_${index}`), 0);
    const isActive = formData.get(`offer_active_${index}`) === "true";

    if (!label || quantity <= 0 || price <= 0) continue;

    offers.push({
      id: `offer-${index + 1}`,
      label,
      price,
      quantity,
      tickets: quantity,
      is_active: isActive,
      sort_order: index,
    });
  }

  return offers;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(request: NextRequest, context: RouteContext) {
  const tenantSlug = getTenantSlugFromRequest(request);
  const id = context.params.id;

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  const raffle = await getRaffleById(id);

  if (!raffle) {
    return NextResponse.json(
      { ok: false, error: "Raffle not found" },
      { status: 404 },
    );
  }

  if (raffle.tenant_slug !== tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true, item: raffle });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const tenantSlug = getTenantSlugFromRequest(request);
  const id = context.params.id;

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  const existing = await getRaffleById(id);

  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "Raffle not found" },
      { status: 404 },
    );
  }

  if (existing.tenant_slug !== tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const existingConfig =
    (existing.config_json as Record<string, unknown> | undefined) ?? {};

  const formData = await request.formData();

  const title = String(formData.get("title") ?? existing.title);
  const slug = slugify(String(formData.get("slug") ?? existing.slug));
  const description = String(
    formData.get("description") ?? existing.description ?? "",
  );
  const image_url = String(formData.get("image_url") ?? existing.image_url ?? "");
  const currency = String(formData.get("currency") ?? existing.currency ?? "GBP");
  const status = String(formData.get("status") ?? existing.status);

  const ticket_price = toNumber(
    formData.get("ticket_price"),
    existing.ticket_price,
  );

  const startNumber = toNumber(
    formData.get("startNumber"),
    toNumber(existingConfig.startNumber, 1),
  );

  const endNumber = toNumber(
    formData.get("endNumber"),
    toNumber(existingConfig.endNumber, existing.total_tickets),
  );

  const presetColours = formData
    .getAll("colour_preset")
    .map((value) => String(value).trim())
    .filter(Boolean);

  const customColours = parseCommaList(String(formData.get("custom_colours") ?? ""));

  const colours = Array.from(new Set([...presetColours, ...customColours]));

  const offers = parseOffersFromForm(formData);

  const numbersPerColour =
    colours.length > 0 && endNumber >= startNumber
      ? endNumber - startNumber + 1
      : toNumber(existingConfig.numbersPerColour, 0);

  const colourCount = colours.length;
  const total_tickets = numbersPerColour * colourCount;

  const updated = await updateRaffle(id, {
    tenant_slug: tenantSlug,
    title,
    slug,
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
    sold: (existingConfig.sold as any) ?? [],
    reserved: (existingConfig.reserved as any) ?? [],
  });

  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "Update failed" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(new URL(`/admin/raffles/${id}`, request.url), {
    status: 303,
  });
}
