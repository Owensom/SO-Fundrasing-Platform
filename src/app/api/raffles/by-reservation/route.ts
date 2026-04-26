// src/app/api/raffles/by-reservation/route.ts
// Fixed imports to match restored db.ts
// Ticket colour mapping preserved

import { NextRequest, NextResponse } from "next/server";
import { getDbClient } from "@/lib/db";
import { mapTickets } from "@/lib/raffles";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("reservation_token");
  if (!token) return NextResponse.json({ ok: false, error: "No token provided" });

  const client = await getDbClient();

  const res = await client.query(
    `SELECT rtr.ticket_number, rtr.colour, r.config_json
     FROM raffle_ticket_reservations rtr
     JOIN raffles r ON r.id = rtr.raffle_id
     WHERE rtr.reservation_token = $1`,
    [token]
  );

  if (!res.rows.length) return NextResponse.json({ ok: false, error: "Not found" });

  const config = res.rows[0].config_json;
  const colours = config.colours || [];

  const tickets = res.rows.map((row: any) => ({
    ticket_number: row.ticket_number,
    colour: row.colour,
  }));

  const mappedTickets = mapTickets(tickets, colours);

  return NextResponse.json({ ok: true, tickets: mappedTickets });
}
