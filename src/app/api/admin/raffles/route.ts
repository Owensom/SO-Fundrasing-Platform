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
    console.error("GET /api/admin/raffles/[id] failed", error);

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
        (existing.config_json as Record<string, unknown> | undefined)
          ?.startNumber as number | undefined,
      endNumber:
        (existing.config_json as Record<string, unknown> | undefined)
          ?.endNumber as number | undefined,
      numbersPerColour:
        (existing.config_json as Record<string, unknown> | undefined)
          ?.numbersPerColour as number | undefined,
      colourCount:
        (existing.config_json as Record<string, unknown> | undefined)
          ?.colourCount as number | undefined,
      colours:
        ((existing.config_json as Record<string, unknown> | undefined)
          ?.colours as string[] | undefined) ?? [],
      offers:
        ((existing.config_json as Record<string, unknown> | undefined)
          ?.offers as
          | Array<{
              id?: string;
              label: string;
              price: number;
              quantity?: number;
              tickets?: number;
              is_active?: boolean;
              sort_order?: number;
            }>
          | undefined) ?? [],
      sold:
        ((existing.config_json as Record<string, unknown> | undefined)
          ?.sold as Array<{ colour: string; number: number }> | undefined) ??
        [],
      reserved:
        ((existing.config_json as Record<string, unknown> | undefined)
          ?.reserved as Array<{ colour: string; number: number }> | undefined) ??
        [],
    });

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Failed to update raffle" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      item: updated,
    });
  } catch (error) {
    console.error("PUT /api/admin/raffles/[id] failed", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
