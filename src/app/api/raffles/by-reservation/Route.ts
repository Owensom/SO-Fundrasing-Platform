import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TicketRow = {
  ticket_number: number;
  colour: string | null;
};

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
        ticket_number,
        colour
      from raffle_ticket_reservations
      where reservation_token = $1
      order by ticket_number asc
      `,
      [token],
    );

    return NextResponse.json({
      ok: true,
      tickets: tickets.map((t) => ({
        ticket_number: t.ticket_number,
        colour: t.colour || "default",
      })),
    });
  } catch (error) {
    console.error("by-reservation error", error);

    return NextResponse.json(
      { ok: false, error: "Failed to load tickets" },
      { status: 500 },
    );
  }
}
