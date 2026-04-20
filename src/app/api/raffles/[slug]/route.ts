import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../../../api/_lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;

  const raffle = await query(
    `
    select *
    from raffles
    where slug = $1
    limit 1
    `,
    [slug]
  );

  if (!raffle.length) {
    return NextResponse.json({ ok: false, error: "Not found" });
  }

  const raffleId = raffle[0].id;

  // sold tickets
  const sold = await query(
    `
    select ticket_number, colour
    from raffle_ticket_sales
    where raffle_id = $1
    `,
    [raffleId]
  );

  // active reservations only (not expired)
  const reserved = await query(
    `
    select ticket_number, colour
    from raffle_ticket_reservations
    where raffle_id = $1
      and status = 'reserved'
      and expires_at > now()
    `,
    [raffleId]
  );

  return NextResponse.json({
    ok: true,
    raffle: raffle[0],
    sold,
    reserved,
  });
}
