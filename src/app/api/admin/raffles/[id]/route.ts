import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import { getRaffleById, updateRaffle } from "../../../../../../api/_lib/raffles-repo";

type RouteContext = {
  params: {
    id: string;
  };
};

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

    const updated = await updateRaffle(id, {
      tenant_slug: tenantSlug,
      title: String(body?.title ?? existing.title),
      slug: String(body?.slug ?? existing.slug),
      description: String(body?.description ?? existing.description ?? ""),
      image_url: String(body?.image_url ?? existing.image_url ?? ""),
      currency: body?.currency ?? existing.currency,
      ticket_price:
        body?.ticket_price != null
          ? Number(body.ticket_price)
          : Number(existing.ticket_price),
      total_tickets:
        body?.total_tickets != null
          ? Number(body.total_tickets)
          : Number(existing.total_tickets),
      sold_tickets:
        body?.sold_tickets != null
          ? Number(body.sold_tickets)
          : Number(existing.sold_tickets),
      status: body?.status ?? existing.status,
      startNumber:
        body?.startNumber != null
          ? Number(body.startNumber)
          : Number(config.startNumber ?? 0),
      endNumber:
        body?.endNumber != null
          ? Number(body.endNumber)
          : Number(config.endNumber ?? 0),
      numbersPerColour:
        body?.numbersPerColour != null
          ? Number(body.numbersPerColour)
          : Number(config.numbersPerColour ?? 0),
      colourCount:
        body?.colourCount != null
          ? Number(body.colourCount)
          : Number(config.colourCount ?? 0),
      colours: Array.isArray(body?.colours)
        ? body.colours
        : Array.isArray(config.colours)
          ? (config.colours as string[])
          : [],
      offers: Array.isArray(body?.offers)
        ? body.offers
        : Array.isArray(config.offers)
          ? (config.offers as Array<{
              id?: string;
              label: string;
              price: number;
              quantity?: number;
              tickets?: number;
              is_active?: boolean;
              sort_order?: number;
            }>)
          : [],
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
