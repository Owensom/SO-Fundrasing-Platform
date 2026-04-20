import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../../../api/_lib/db";

type TicketRow = {
  ticket_number: number;
  colour: string | null;
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

    const tickets = await query<TicketRow>(
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

    return NextResponse.json({
      ok: true,
      tickets: tickets.map((ticket) => ({
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
