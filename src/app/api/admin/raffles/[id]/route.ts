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

type OfferInput = {
  id?: string;
  label?: string;
  price?: number;
  price_cents?: number;
  quantity?: number;
  tickets?: number;
  is_active?: boolean;
  isActive?: boolean;
  active?: boolean;
  sort_order?: number;
  sortOrder?: number;
};

function parseNumber(
  value: FormDataEntryValue | string | null | undefined,
  fallback = 0,
) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseColours(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normaliseOffers(value: unknown): Array<{
  id?: string;
  label: string;
  price: number;
  quantity?: number;
  tickets?: number;
  is_active?: boolean;
  sort_order?: number;
}> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      const raw = item as OfferInput;

      const label = String(raw.label ?? "").trim();
      const quantity = Number(raw.quantity ?? raw.tickets ?? 0);

      const price =
        raw.price != null
          ? Number(raw.price)
          : raw.price_cents != null
            ? Number(raw.price_cents) / 100
            : 0;

      const isActive =
        raw.is_active === true ||
        raw.isActive === true ||
        raw.active === true;

      const sortOrder = Number(raw.sort_order ?? raw.sortOrder ?? index);

      if (!label || !Number.isFinite(quantity) || quantity <= 0) return null;
      if (!Number.isFinite(price) || price <= 0) return null;

      return {
        id: raw.id || `offer-${quantity}-${index}`,
        label,
        price,
        quantity,
        tickets: quantity,
        is_active: isActive,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : index,
      };
    })
    .filter(
      (
        offer,
      ): offer is {
        id?: string;
        label: string;
        price: number;
        quantity?: number;
        tickets?: number;
        is_active?: boolean;
        sort_order?: number;
      } => offer !== null,
    );
}

function parseOffers(value: string) {
  if (!value.trim()) return [];

  try {
    return normaliseOffers(JSON.parse(value));
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

export async function GET(request: NextRequest, context: RouteContext) {
  const tenantSlug = getTenantSlugFromRequest(request);
  const id = context.params.id;

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  try {
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

    return NextResponse.json({
      ok: true,
      item: raffle,
    });
  } catch (error) {
    console.error("GET raffle failed:", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
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

  try {
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

    const formData = await request.formData();
    const existingConfig =
      (existing.config_json as Record<string, unknown> | undefined) ?? {};

    const title = String(formData.get("title") ?? existing.title).trim();
    const rawSlug = String(formData.get("slug") ?? existing.slug).trim();
    const slug = slugify(rawSlug || existing.slug);
    const description = String(
      formData.get("description") ?? existing.description ?? "",
    ).trim();

    const image_url = String(
      formData.get("image_url") ?? existing.image_url ?? "",
    ).trim();

    const currency = String(formData.get("currency") ?? existing.currency);
    const status = String(formData.get("status") ?? existing.status);

    const ticket_price = parseNumber(
      formData.get("ticket_price"),
      existing.ticket_price,
    );

    const startNumber = parseNumber(
      formData.get("startNumber"),
      Number(existingConfig.startNumber ?? 0),
    );

    const endNumber = parseNumber(
      formData.get("endNumber"),
      Number(existingConfig.endNumber ?? 0),
    );

    const submittedColours = String(formData.get("colours") ?? "");
    const colours =
      submittedColours.trim().length > 0
        ? parseColours(submittedColours)
        : Array.isArray(existingConfig.colours)
          ? (existingConfig.colours as string[])
          : [];

    const submittedOffers = String(formData.get("offers") ?? "");
    const offers =
      submittedOffers.trim().length > 0
        ? parseOffers(submittedOffers)
        : normaliseOffers(existingConfig.offers ?? []);

    const numbersPerColour =
      colours.length > 0 && endNumber >= startNumber
        ? endNumber - startNumber + 1
        : Number(existingConfig.numbersPerColour ?? 0);

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
      sold:
        (existingConfig.sold as
          | Array<{ colour: string; number: number }>
          | undefined) ?? [],
      reserved:
        (existingConfig.reserved as
          | Array<{ colour: string; number: number }>
          | undefined) ?? [],
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
  } catch (error) {
    console.error("POST raffle update failed:", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const tenantSlug = getTenantSlugFromRequest(request);
  const id = context.params.id;

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  try {
    const body = await request.json();
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

    const config = (existing.config_json ?? {}) as Record<string, unknown>;

    const colours = Array.isArray(body?.colours)
      ? body.colours
      : Array.isArray(config.colours)
        ? (config.colours as string[])
        : [];

    const startNumber =
      body?.startNumber != null
        ? Number(body.startNumber)
        : Number(config.startNumber ?? 0);

    const endNumber =
      body?.endNumber != null
        ? Number(body.endNumber)
        : Number(config.endNumber ?? 0);

    const numbersPerColour =
      colours.length > 0 && endNumber >= startNumber
        ? endNumber - startNumber + 1
        : 0;

    const colourCount = colours.length;
    const total_tickets = numbersPerColour * colourCount;

    const updated = await updateRaffle(id, {
      tenant_slug: tenantSlug,
      title: String(body?.title ?? existing.title),
      slug: slugify(String(body?.slug ?? existing.slug)),
      description: String(body?.description ?? existing.description ?? ""),
      image_url: String(body?.image_url ?? existing.image_url ?? ""),
      currency: body?.currency ?? existing.currency,
      ticket_price:
        body?.ticket_price != null
          ? Number(body.ticket_price)
          : Number(existing.ticket_price),
      total_tickets,
      sold_tickets:
        body?.sold_tickets != null
          ? Number(body.sold_tickets)
          : Number(existing.sold_tickets),
      status: body?.status ?? existing.status,
      startNumber,
      endNumber,
      numbersPerColour,
      colourCount,
      colours,
      offers: Array.isArray(body?.offers)
        ? normaliseOffers(body.offers)
        : normaliseOffers(config.offers ?? []),
      sold: Array.isArray(config.sold)
        ? (config.sold as Array<{ colour: string; number: number }>)
        : [],
      reserved: Array.isArray(config.reserved)
        ? (config.reserved as Array<{ colour: string; number: number }>)
        : [],
    });

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Update failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      item: updated,
    });
  } catch (error) {
    console.error("PUT raffle failed:", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
