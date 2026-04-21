import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { calculateOfferTotal } from "@/lib/pricing";

export const runtime = "nodejs";

type RaffleRow = {
  id: string;
  slug: string;
  ticket_price_cents: number;
  config_json: any;
};

type ExistingReservation = {
  ticket_number: number;
  colour: string | null;
};

type SelectedTicket = {
  ticket_number: number;
  colour: string;
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const body = await req.json();

    const buyerName =
      typeof body.buyerName === "string" ? body.buyerName.trim() : "";
    const buyerEmail =
      typeof body.buyerEmail === "string" ? body.buyerEmail.trim() : "";
    const selectedTickets = Array.isArray(body.selectedTickets)
      ? (body.selectedTickets as SelectedTicket[])
      : [];

    if (!buyerName || !buyerEmail || selectedTickets.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid input" },
        { status: 400 },
      );
    }

    const raffle = await queryOne<RaffleRow>(
      `
      select id, slug, ticket_price_cents, config_json
      from raffles
      where slug = $1
      limit 1
      `,
      [slug],
    );

    if (!raffle) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 },
      );
    }

    const offers = (raffle.config_json?.offers || [])
      .filter((o: any) => o.is_active !== false)
      .map((o: any) => ({
        label: o.label,
        quantity: Number(o.quantity || o.tickets),
        price: Number(o.price),
      }))
      .filter((o: any) => o.quantity > 0 && o.price >= 0);

    const totalAmountCents = calculateOfferTotal(
      selectedTickets.length,
      raffle.ticket_price_cents,
      offers,
    );

    const baseUnitPriceCents = Math.floor(
      totalAmountCents / selectedTickets.length,
    );
    const remainder = totalAmountCents % selectedTickets.length;

    const reservationToken = crypto.randomUUID();
    const reservationGroupId = crypto.randomUUID();

    const existing = await query<ExistingReservation>(
      `
      select ticket_number, colour
      from raffle_ticket_reservations
      where raffle_id = $1
        and status = 'reserved'
        and expires_at > now()

      union all

      select ticket_number, colour
      from raffle_ticket_sales
      where raffle_id = $1
      `,
      [raffle.id],
    );

    const taken = new Set(
      existing.map((r) => `${r.colour || "default"}-${r.ticket_number}`),
    );

    for (const ticket of selectedTickets) {
      const key = `${ticket.colour || "default"}-${ticket.ticket_number}`;
      if (taken.has(key)) {
        return NextResponse.json(
          { ok: false, error: "Ticket already reserved or sold" },
          { status: 400 },
        );
      }
    }

    for (let index = 0; index < selectedTickets.length; index++) {
      const ticket = selectedTickets[index];
      const unitPriceCents =
        baseUnitPriceCents + (index < remainder ? 1 : 0);

      await query(
        `
        insert into raffle_ticket_reservations (
          id,
          reservation_group_id,
          raffle_id,
          colour,
          ticket_number,
          buyer_name,
          buyer_email,
          expires_at,
          reservation_token,
          unit_price_cents,
          status,
          created_at
        )
        values (
          $1::uuid,
          $2::uuid,
          $3,
          $4,
          $5,
          $6,
          $7,
          now() + interval '15 minutes',
          $8,
          $9,
          'reserved',
          now()
        )
        `,
        [
          crypto.randomUUID(),
          reservationGroupId,
          raffle.id,
          ticket.colour || "default",
          ticket.ticket_number,
          buyerName,
          buyerEmail,
          reservationToken,
          unitPriceCents,
        ],
      );
    }

    return NextResponse.json({
      ok: true,
      reservationToken,
      raffleId: raffle.id,
      totalAmountCents,
    });
  } catch (err) {
    console.error("reserve error", err);

    return NextResponse.json(
      { ok: false, error: "Reservation failed" },
      { status: 500 },
    );
  }
}
