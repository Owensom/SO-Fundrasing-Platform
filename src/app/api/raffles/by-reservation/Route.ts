import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaymentRow = {
  id: string;
};

type SaleRow = {
  ticket_number: number;
  colour: string | null;
  colour_id: string | null;
};

type ReservationRow = {
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

    const payment = await queryOne<PaymentRow>(
      `
      select id
      from raffle_payments
      where reservation_token = $1
      limit 1
      `,
      [token],
    );

    if (payment) {
      const sales = await query<SaleRow>(
        `
        select
          ticket_number,
          colour,
          colour_id
        from raffle_ticket_sales
        where payment_id = $1
        order by ticket_number asc
        `,
        [payment.id],
      );

      if (sales.length > 0) {
        return NextResponse.json({
          ok: true,
          tickets: sales.map((t) => ({
            ticket_number: t.ticket_number,
            colour: t.colour || t.colour_id || "default",
          })),
        });
      }
    }

    const reservations = await query<ReservationRow>(
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
      tickets: reservations.map((t) => ({
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
