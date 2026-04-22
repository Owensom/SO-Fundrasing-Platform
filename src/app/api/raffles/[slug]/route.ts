import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type DbRaffleRow = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
  currency: string | null;
  ticket_price_cents: number | null;
  total_tickets: number | null;
  sold_tickets: number | null;
  status: string | null;
  config_json: {
    startNumber?: number;
    endNumber?: number;
    colours?: unknown[];
    offers?: unknown[];
  } | null;
  winner_ticket_number?: number | null;
  winner_colour?: string | null;
  drawn_at?: string | null;
};

type TicketRow = {
  ticket_number: number;
  colour: string | null;
};

function normalizeColourItem(value: unknown, index: number) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return {
      id: `colour-${index}`,
      name: trimmed || `Colour ${index + 1}`,
      hex: trimmed.startsWith("#") ? trimmed : null,
      sortOrder: index,
    };
  }

  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;

    const name =
      typeof row.name === "string" && row.name.trim()
        ? row.name.trim()
        : typeof row.label === "string" && row.label.trim()
          ? row.label.trim()
          : typeof row.id === "string" && row.id.trim()
            ? row.id.trim()
            : `Colour ${index + 1}`;

    const hex =
      typeof row.hex === "string" && row.hex.trim()
        ? row.hex.trim()
        : null;

    const id =
      typeof row.id === "string" && row.id.trim()
        ? row.id.trim()
        : `colour-${index}`;

    const sortOrder = Number.isFinite(Number(row.sortOrder))
      ? Number(row.sortOrder)
      : Number.isFinite(Number(row.sort_order))
        ? Number(row.sort_order)
        : index;

    return {
      id,
      name,
      hex,
      sortOrder,
    };
  }

  return {
    id: `colour-${index}`,
    name: `Colour ${index + 1}`,
    hex: null,
    sortOrder: index,
  };
}

function normalizeOfferItem(value: unknown, index: number) {
  if (!value || typeof value !== "object") {
    return {
      id: `offer-${index}`,
      label: `Offer ${index + 1}`,
      quantity: 0,
      price: 0,
      isActive: true,
      sortOrder: index,
    };
  }

  const row = value as Record<string, unknown>;

  return {
    id:
      typeof row.id === "string" && row.id.trim()
        ? row.id.trim()
        : `offer-${index}`,
    label:
      typeof row.label === "string" && row.label.trim()
        ? row.label.trim()
        : `Offer ${index + 1}`,
    quantity: Number(row.quantity ?? row.tickets ?? 0) || 0,
    price: Number(row.price ?? 0) || 0,
    isActive: Boolean(row.isActive ?? row.is_active ?? true),
    sortOrder: Number(row.sortOrder ?? row.sort_order ?? index) || index,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const raffleRows = await query<DbRaffleRow>(
      `
      select *
      from raffles
      where slug = $1
      limit 1
      `,
      [params.slug]
    );

    if (!raffleRows.length) {
      return NextResponse.json(
        { ok: false, error: "Not found" },
        { status: 404 }
      );
    }

    const raffle = raffleRows[0];
    const raffleId = raffle.id;
    const config = raffle.config_json ?? {};

    const sold = await query<TicketRow>(
      `
      select ticket_number, colour
      from raffle_ticket_sales
      where raffle_id = $1
      order by ticket_number asc
      `,
      [raffleId]
    );

    const reserved = await query<TicketRow>(
      `
      select ticket_number, colour
      from raffle_ticket_reservations
      where raffle_id = $1
        and status = 'reserved'
        and expires_at > now()
      order by ticket_number asc
      `,
      [raffleId]
    );

    const coloursRaw = Array.isArray(config.colours) ? config.colours : [];
    const offersRaw = Array.isArray(config.offers) ? config.offers : [];

    return NextResponse.json({
      ok: true,
      raffle: {
        id: raffle.id,
        tenantSlug: raffle.tenant_slug,
        tenant_slug: raffle.tenant_slug,
        slug: raffle.slug,
        title: raffle.title,
        description: raffle.description ?? "",
        imageUrl: raffle.image_url ?? "",
        image_url: raffle.image_url ?? "",
        currency: raffle.currency ?? "GBP",
        ticketPrice: Number(raffle.ticket_price_cents ?? 0) / 100,
        totalTickets: Number(raffle.total_tickets ?? 0),
        soldTicketsCount: Number(raffle.sold_tickets ?? 0),
        status: raffle.status ?? "draft",
        startNumber: Number(config.startNumber ?? 1),
        endNumber: Number(config.endNumber ?? 1),
        colours: coloursRaw.map(normalizeColourItem),
        offers: offersRaw.map(normalizeOfferItem),
        soldTickets: sold.map((t) => ({
          number: Number(t.ticket_number),
          colour: t.colour || "default",
        })),
        reservedTickets: reserved.map((t) => ({
          number: Number(t.ticket_number),
          colour: t.colour || "default",
        })),
        winnerTicketNumber:
          raffle.winner_ticket_number != null
            ? Number(raffle.winner_ticket_number)
            : null,
        winnerColour: raffle.winner_colour ?? null,
        drawnAt: raffle.drawn_at ?? null,
      },
    });
  } catch (error: any) {
    console.error("public raffle route error", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}
