import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import { getRaffleById, updateRaffle } from "../../../../../../../api/_lib/raffles-repo";

type RouteContext = {
  params: {
    id: string;
  };
};

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
    const nextStatus = String(formData.get("status") ?? "").trim();

    if (
      nextStatus !== "draft" &&
      nextStatus !== "published" &&
      nextStatus !== "closed"
    ) {
      return NextResponse.json(
        { ok: false, error: "Invalid status" },
        { status: 400 },
      );
    }

    const config = (existing.config_json ?? {}) as Record<string, unknown>;

    const updated = await updateRaffle(id, {
      tenant_slug: tenantSlug,
      title: existing.title,
      slug: existing.slug,
      description: existing.description ?? "",
      image_url: existing.image_url ?? "",
      currency: existing.currency as "GBP" | "USD" | "EUR",
      ticket_price: Number(existing.ticket_price),
      total_tickets: Number(existing.total_tickets),
      sold_tickets: Number(existing.sold_tickets),
      status: nextStatus as "draft" | "published" | "closed",
      startNumber: Number(config.startNumber ?? 0),
      endNumber: Number(config.endNumber ?? 0),
      numbersPerColour: Number(config.numbersPerColour ?? 0),
      colourCount: Number(config.colourCount ?? 0),
      colours: Array.isArray(config.colours)
        ? (config.colours as string[])
        : [],
      offers: Array.isArray(config.offers)
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

    return NextResponse.redirect(
      new URL(`/admin/raffles/${id}`, request.url),
      { status: 303 },
    );
  } catch (error) {
    console.error("POST raffle status update failed:", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
