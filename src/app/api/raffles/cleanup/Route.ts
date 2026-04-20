import { NextResponse } from "next/server";
import { query } from "../../../../api/_lib/db";

export async function POST() {
  await query(`
    update raffle_ticket_reservations
    set status = 'expired'
    where status = 'reserved'
      and expires_at < now()
  `);

  return NextResponse.json({ ok: true });
}
