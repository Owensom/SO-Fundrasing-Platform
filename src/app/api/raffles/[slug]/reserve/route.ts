import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "../../../../../api/_lib/db";
import { calculateOfferTotal } from "../../../../../api/_lib/pricing";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { buyerName, buyerEmail, selectedTickets } = body;

    if (!buyerName || !buyerEmail || !Array.isArray(selectedTickets)) {
      return NextResponse.json(
        { ok: false, error: "Invalid input" },
        { status: 400 }
      );
    }

    const slug = req.nextUrl.pathname.split("/").slice(-2)[0];

    const raffle = await queryOne<RaffleRow>(
      `
      select id, slug, ticket_price_cents, config_json
      from raffles
      where slug = $1
      `,
      [slug]
    );

    if (!raffle) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 }
      );
    }

    // ✅ Normalize offers
    const offers = (raffle.config_json?.offers || [])
      .filter((o: any) => o.is_active !== false)
      .map((o: any) => ({
        label: o.label,
        quantity: Number(o.quantity || o.tickets),
        price: Number(o.price),
      }))
      .filter((o: any) => o.quantity > 0 && o.price >= 0);

    // ✅ Calculate correct total (SERVER SIDE)
    const totalAmountCents = calculateOfferTotal(
      selectedTickets.length,
      raffle.ticket_price_cents,
      offers
    );

    // Spread evenly across tickets
    const unitPriceCents = Math.round(
      totalAmountCents / selectedTickets.length
    );

    const reservationToken = crypto.randomUUID();
    const reservationGroupId = crypto.randomUUID();

    // Check availability
    const existing = await query<ExistingReservation>(
      `
      select ticket_number, colour
      from raffle_ticket_reservations
      where raffle_id = $1
        and status in ('reserved', 'sold')
      `,
      [raffle.id]
    );

    const taken = new Set(
      existing.map(
        (r) => `${r.colour || "default"}-${r.ticket_number}`
      )
    );

    for (const ticket of selectedTickets) {
      const key = `${ticket.colour || "default"}-${ticket.ticket_number}`;
      if (taken.has(key)) {
        return NextResponse.json(
          { ok: false, error: "Ticket already reserved or sold" },
          { status: 400 }
        );
      }
    }

    // Insert reservations
    for (const ticket of selectedTickets) {
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
          $1,$2,$3,$4,$5,$6,$7,
          now() + interval '15 minutes',
          $8,$9,'reserved', now()
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
        ]
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
      { status: 500 }
    );
  }
}
