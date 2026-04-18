import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireRaffleAdminAccess } from "@/lib/authz";
import { normalizeStatus, parseConfig, type RaffleStatus } from "@/lib/raffles";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ id: string }>;
};

type UpdateBody = {
  title?: string;
  description?: string | null;
  image_url?: string | null;
  ticket_price_cents?: number;
  total_tickets?: number;
  currency?: string;
  config_json?: unknown;
  status?: RaffleStatus;
  action?: "save" | "publish" | "complete";
};

function errorResponse(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHENTICATED") {
      return NextResponse.json(
        { ok: false, error: "Unauthenticated" },
        { status: 401 },
      );
    }

    if (error.message === "FORBIDDEN") {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    if (error.message === "NOT_FOUND") {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: false, error: "Unknown server error" },
    { status: 500 },
  );
}

export async function GET(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    await requireRaffleAdminAccess(id);

    const rows = await sql`
      select
        id,
        tenant_slug,
        slug,
        title,
        description,
        image_url,
        ticket_price_cents,
        total_tickets,
        sold_tickets,
        status,
        created_at,
        updated_at,
        currency,
        config_json
      from raffles
      where id = ${id}
      limit 1
    `;

    if (!rows.length) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 },
      );
    }

    const row = rows[0];

    return NextResponse.json({
      ok: true,
      raffle: {
        ...row,
        status: normalizeStatus(row.status),
        config_json: parseConfig(row.config_json),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await requireRaffleAdminAccess(id);

    const body = (await req.json()) as UpdateBody;

    const existingRows = await sql`
      select id, status, config_json
      from raffles
      where id = ${id}
      limit 1
    `;

    if (!existingRows.length) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 },
      );
    }

    const existing = existingRows[0];
    const currentConfig = parseConfig(existing.config_json);

    let nextStatus: RaffleStatus = normalizeStatus(existing.status);

    if (body.action === "save") nextStatus = "draft";
    if (body.action === "publish") nextStatus = "published";
    if (body.action === "complete") nextStatus = "completed";
    if (body.status) nextStatus = normalizeStatus(body.status);

    const nextConfig = body.config_json
      ? parseConfig(body.config_json)
      : currentConfig;

    const startNumber = Number(nextConfig.startNumber);
    const endNumber = Number(nextConfig.endNumber);
    const derivedTotalTickets =
      nextConfig.colours.length > 0
        ? (endNumber - startNumber + 1) * nextConfig.colours.length
        : endNumber - startNumber + 1;

    const rows = await sql`
      update raffles
      set
        title = coalesce(${body.title ?? null}, title),
        description = ${body.description ?? null},
        image_url = ${body.image_url ?? null},
        ticket_price_cents = coalesce(${body.ticket_price_cents ?? null}, ticket_price_cents),
        total_tickets = coalesce(${body.total_tickets ?? derivedTotalTickets}, total_tickets),
        currency = coalesce(${body.currency ?? null}, currency),
        config_json = ${JSON.stringify(nextConfig)}::jsonb,
        status = ${nextStatus},
        updated_at = now()
      where id = ${id}
      returning
        id,
        tenant_slug,
        slug,
        title,
        description,
        image_url,
        ticket_price_cents,
        total_tickets,
        sold_tickets,
        status,
        created_at,
        updated_at,
        currency,
        config_json
    `;

    return NextResponse.json({
      ok: true,
      raffle: {
        ...rows[0],
        status: normalizeStatus(rows[0].status),
        config_json: parseConfig(rows[0].config_json),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await requireRaffleAdminAccess(id);

    await sql`
      delete from raffle_ticket_reservations
      where raffle_id = ${id}
    `;

    await sql`
      delete from raffle_ticket_sales
      where raffle_id = ${id}
    `;

    const deleted = await sql`
      delete from raffles
      where id = ${id}
      returning id
    `;

    if (!deleted.length) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      deletedId: String(deleted[0].id),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
