import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const raffleRows = await query<any>(
    `
    select *
    from raffles
    where slug = $1
    limit 1
    `,
    [slug],
  );

  if (!raffleRows.length) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const raffle = raffleRows[0];
  const raffleId = raffle.id;

  const sold = await query<{ ticket_number: number; colour: string | null }>(
    `
    select ticket_number, colour
    from raffle_ticket_sales
    where raffle_id = $1
    `,
    [raffleId],
  );

  const reserved = await query<{ ticket_number: number; colour: string | null }>(
    `
    select ticket_number, colour
    from raffle_ticket_reservations
    where raffle_id = $1
      and status = 'reserved'
      and expires_at > now()
    `,
    [raffleId],
  );

  return NextResponse.json({
    ok: true,
    raffle,
    sold: sold.map((t) => ({
      ticket_number: t.ticket_number,
      colour: t.colour || "default",
    })),
    reserved: reserved.map((t) => ({
      ticket_number: t.ticket_number,
      colour: t.colour || "default",
    })),
  });
}
