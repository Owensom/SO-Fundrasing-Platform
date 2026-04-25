import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import {
  getRaffleById,
  updateRaffle,
} from "../../../../../../api/_lib/raffles-repo";
import { queryOne } from "@/lib/db";

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

function toOptionalNumber(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatOfferLabel(quantity: number, price: number) {
  return `${quantity} for ${price.toFixed(2)}`;
}

function parseOffersFromForm(formData: FormData): Offer[] {
  const count = toNumber(formData.get("offer_count"), 0);
  const offers: Offer[] = [];

  for (let index = 0; index < count; index += 1) {
    const quantity = toOptionalNumber(formData.get(`offer_quantity_${index}`));
    const price = toOptionalNumber(formData.get(`offer_price_${index}`));
    const isActive = formData.get(`offer_active_${index}`) === "true";

    if (quantity == null || price == null) continue;
    if (quantity <= 0 || price <= 0) continue;

    offers.push({
      id: `offer-${index + 1}`,
      label: formatOfferLabel(quantity, price),
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

async function restorePrizesAfterRaffleUpdate(
  raffleId: string,
  prizes: unknown
) {
  await queryOne<{ id: string }>(
    `
    update raffles
    set config_json = jsonb_set(
      coalesce(config_json, '{}'::jsonb),
      '{prizes}',
      $2::jsonb,
      true
    )
    where id = $1
    returning id
    `,
    [raffleId, JSON.stringify(Array.isArray(prizes) ? prizes : [])]
  );
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

  const existingPrizes = Array.isArray(existingConfig.prizes)
    ? existingConfig.prizes
    : [];

  const formData = await request.formData();

  const title = String(formData.get("title") ?? existing.title);
  const slug = slugify(String(formData.get("slug") ?? existing.slug));
  const description = String(
    formData.get("description") ?? existing.description ?? "",
  );
  const image_url = String(formData.get("image_url") ?? existing.image_url ?? "");
  const currency = String(formData.get("currency") ?? existing.currency ?? "GBP");
  const status = String(formData.get("status") ?? existing.status) as
    | "draft"
    | "published"
    | "closed"
    | "drawn";

  const rawTicketPrice = toOptionalNumber(formData.get("ticket_price"));
  const ticket_price = rawTicketPrice ?? 0;

  if (status !== "draft" && ticket_price <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Ticket price is required before publishing, closing, or drawing a raffle.",
      },
      { status: 400 },
    );
  }

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
    status,
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

  await restorePrizesAfterRaffleUpdate(id, existingPrizes);

  return NextResponse.redirect(new URL(`/admin/raffles/${id}`, request.url), {
    status: 303,
  });
}
