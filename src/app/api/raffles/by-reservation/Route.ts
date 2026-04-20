import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../../../api/_lib/db";

type SoldTicketRow = {
  ticket_number: number;
  colour: string | null;
};

type ReservedTicketRow = {
  ticket_number: number;
  colour: string | null;
  status: string;
  payment_id: string | null;
  checkout_session_id: string | null;
};

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Missing token" },
        { status: 400 },
      );
    }

    const soldTickets = await query<SoldTicketRow>(
      `
      select
        s.ticket_number,
        s.colour
      from raffle_ticket_sales s
      join raffle_ticket_reservations r
        on s.reservation_id = r.id::text
      where r.reservation_token = $1
      order by s.ticket_number asc
      `,
      [token],
    );

    if (soldTickets.length > 0) {
      return NextResponse.json({
        ok: true,
        tickets: soldTickets.map((ticket) => ({
          ticket_number: ticket.ticket_number,
          colour: ticket.colour || "default",
        })),
      });
    }

    const reservedTickets = await query<ReservedTicketRow>(
      `
      select
        ticket_number,
        colour,
        status,
        payment_id,
        checkout_session_id
      from raffle_ticket_reservations
      where reservation_token = $1
        and (
          status = 'sold'
          or payment_id is not null
          or checkout_session_id is not null
        )
      order by ticket_number asc
      `,
      [token],
    );

    return NextResponse.json({
      ok: true,
      tickets: reservedTickets.map((ticket) => ({
        ticket_number: ticket.ticket_number,
        colour: ticket.colour || "default",
      })),
    });
  } catch (error) {
    console.error("by-reservation route error", error);

    return NextResponse.json(
      { ok: false, error: "Failed to fetch tickets" },
      { status: 500 },
    );
  }
}
