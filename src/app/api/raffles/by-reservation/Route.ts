import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../../../api/_lib/db";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ ok: false });
  }

  const tickets = await query(
    `
    select ticket_number, colour
    from raffle_ticket_sales
    where reservation_id in (
      select id from raffle_ticket_reservations
      where reservation_token = $1
    )
    `,
    [token],
  );

  return NextResponse.json({ ok: true, tickets });
}
