import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import {
  getRaffleById,
  updateRaffle,
} from "../../../../../../../api/_lib/raffles-repo";

type RouteContext = {
  params: {
    id: string;
  };
};

type CurrencyCode = "GBP" | "USD" | "EUR";
type EditableRaffleStatus = "draft" | "published" | "closed";

function normalizeCurrency(value: unknown): CurrencyCode {
  if (value === "GBP" || value === "USD" || value === "EUR") {
    return value;
  }

  return "EUR";
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
      draw_at: existing.draw_at ?? null,
      image_position: String(config.image_position ?? "center"),
      currency: normalizeCurrency(existing.currency),
      ticket_price: Number(existing.ticket_price ?? 0),
      total_tickets: Number(existing.total_tickets ?? 0),
      sold_tickets: Number(existing.sold_tickets ?? 0),
      status: nextStatus as EditableRaffleStatus,
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
      prizes: Array.isArray(config.prizes)
        ? (config.prizes as Array<{
            id?: string;
            title?: string;
            name?: string;
            description?: string;
            isPublic?: boolean;
            is_public?: boolean;
            position?: number;
            sortOrder?: number;
            sort_order?: number;
          }>)
        : [],
      sold: Array.isArray(config.sold)
        ? (config.sold as Array<{ colour: string; number: number }>)
        : [],
      reserved: Array.isArray(config.reserved)
        ? (config.reserved as Array<{ colour: string; number: number }>)
        : [],
      ...(config.question &&
      typeof config.question === "object" &&
      String((config.question as Record<string, unknown>).text ?? "").trim() &&
      String((config.question as Record<string, unknown>).answer ?? "").trim()
        ? {
            question: {
              text: String(
                (config.question as Record<string, unknown>).text ?? "",
              ).trim(),
              answer: String(
                (config.question as Record<string, unknown>).answer ?? "",
              ).trim(),
            },
          }
        : {}),
    } as any);

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
