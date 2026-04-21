import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type TicketRow = {
  ticket_number: number;
  colour: string | null;
  status: string;
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

    // 🔥 ALWAYS read from reservations (source of truth)
    const tickets = await query<TicketRow>(
      `
      select
        ticket_number,
        colour,
        status
      from raffle_ticket_reservations
      where reservation_token = $1
      order by ticket_number asc
      `,
      [token],
    );

    if (!tickets.length) {
      return NextResponse.json({ ok: true, tickets: [] });
    }

    // Only return if payment has happened
    const isSold = tickets.every((t) => t.status === "sold");

    if (!isSold) {
      return NextResponse.json({ ok: true, tickets: [] });
    }

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
