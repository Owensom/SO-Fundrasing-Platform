import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RaffleRow = {
  id: string;
  tenant_slug: string;
  total_tickets: number | null;
  config_json: any;
};

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function cleanEmail(value: FormDataEntryValue | null) {
  return String(value || "").trim().toLowerCase();
}

function parseTicketNumber(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const formData = await request.formData();

  const ticketNumber = parseTicketNumber(formData.get("ticket_number"));
  const colour = cleanText(formData.get("colour")) || null;
  const buyerName = cleanText(formData.get("buyer_name")) || "Postal entrant";
  const buyerEmail = cleanEmail(formData.get("buyer_email"));

  if (!ticketNumber || !buyerEmail) {
    return NextResponse.json(
      { ok: false, error: "Ticket number and email are required" },
      { status: 400 },
    );
  }

  const raffle = await queryOne<RaffleRow>(
    `
    select id, tenant_slug, total_tickets, config_json
    from raffles
    where id = $1
    limit 1
    `,
    [params.id],
  );

  if (!raffle) {
    return NextResponse.json(
      { ok: false, error: "Raffle not found" },
      { status: 404 },
    );
  }

  const config = raffle.config_json || {};
  const startNumber = Number(config.startNumber || 1);
  const endNumber = Number(config.endNumber || raffle.total_tickets || 0);

  if (endNumber > 0 && (ticketNumber < startNumber || ticketNumber > endNumber)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Ticket number must be between ${startNumber} and ${endNumber}`,
      },
      { status: 400 },
    );
  }

  const existingTicket = await queryOne<{ id: string }>(
    `
    select id
    from raffle_ticket_sales
    where raffle_id = $1
      and ticket_number = $2
    limit 1
    `,
    [raffle.id, ticketNumber],
  );

  if (existingTicket) {
    return NextResponse.json(
      { ok: false, error: "That ticket number is already in the draw" },
      { status: 409 },
    );
  }

  await query(
    `
    insert into raffle_ticket_sales (
      id,
      tenant_slug,
      raffle_id,
      ticket_number,
      colour,
      buyer_name,
      buyer_email
    )
    values ($1,$2,$3,$4,$5,$6,$7)
    `,
    [
      crypto.randomUUID(),
      raffle.tenant_slug,
      raffle.id,
      ticketNumber,
      colour,
      buyerName,
      buyerEmail,
    ],
  );

  await query(
    `
    update raffles
    set sold_tickets = (
      select count(*)
      from raffle_ticket_sales
      where raffle_id = $1
        and ticket_number is not null
    )
    where id = $1
    `,
    [raffle.id],
  );

  return NextResponse.redirect(
    new URL(`/admin/raffles/${raffle.id}`, request.url),
    { status: 303 },
  );
}
