import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { closeRaffle, deleteRaffle, getRaffleById } from "@/lib/raffles";
import { query, queryOne } from "@/lib/db";
import { sendWinnerEmail } from "@/lib/email";

type Body = {
  action?: "close" | "draw" | "delete" | "publish";
  winnerCount?: number;
};

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // ✅ SUPPORT BOTH FORM + JSON
    let body: Body = {};

    try {
      body = (await request.json()) as Body;
    } catch {
      const formData = await request.formData();
      body = {
        action: formData.get("action") as any,
        winnerCount: Number(formData.get("winnerCount") || 1),
      };
    }

    const raffleId = params.id;

    const raffle = await getRaffleById(raffleId);

    if (!raffle) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 }
      );
    }

    // ✅ FIX: ALLOW PUBLISH FROM DRAFT
    if (body.action === "publish") {
      await query(
        `
        update raffles
        set status = 'published',
            updated_at = now()
        where id = $1
        `,
        [raffleId]
      );

      return NextResponse.json({ ok: true });
    }

    if (body.action === "close") {
      const updated = await closeRaffle(raffleId);
      return NextResponse.json({ ok: true, raffle: updated });
    }

    if (body.action === "delete") {
      const deleted = await deleteRaffle(raffleId);

      if (!deleted) {
        return NextResponse.json(
          { ok: false, error: "Delete failed" },
          { status: 400 }
        );
      }

      return NextResponse.json({ ok: true, deleted: true });
    }

    if (body.action !== "draw") {
      return NextResponse.json(
        { ok: false, error: "Unknown action" },
        { status: 400 }
      );
    }

    // 🔒 DRAW ONLY FROM CLOSED
    if (raffle.status !== "closed") {
      return NextResponse.json(
        { ok: false, error: "Only closed raffles can be drawn." },
        { status: 400 }
      );
    }

    const existingWinner = await queryOne<{ count: number }>(
      `
      select count(*)::int as count
      from raffle_winners
      where raffle_id = $1
      `,
      [raffleId]
    );

    if (Number(existingWinner?.count ?? 0) > 0) {
      return NextResponse.json(
        { ok: false, error: "Winner already drawn." },
        { status: 400 }
      );
    }

    const soldTickets = await query(
      `
      select
        id::text as sale_id,
        ticket_number::int,
        colour,
        buyer_email,
        buyer_name
      from raffle_ticket_reservations
      where raffle_id = $1
        and status = 'sold'
      `,
      [raffleId]
    );

    if (!soldTickets.length) {
      return NextResponse.json(
        { ok: false, error: "No sold tickets found" },
        { status: 400 }
      );
    }

    const winner = soldTickets[
      crypto.randomInt(0, soldTickets.length)
    ];

    await query(
      `
      insert into raffle_winners (
        raffle_id,
        prize_position,
        ticket_number,
        colour,
        sale_id,
        buyer_name,
        buyer_email,
        drawn_at
      )
      values ($1, 1, $2, $3, $4, $5, $6, now())
      `,
      [
        raffleId,
        winner.ticket_number,
        winner.colour,
        winner.sale_id,
        winner.buyer_name,
        winner.buyer_email,
      ]
    );

    await query(
      `
      update raffles
      set status = 'drawn',
          winner_ticket_number = $2,
          winner_colour = $3,
          winner_sale_id = $4,
          drawn_at = now(),
          updated_at = now()
      where id = $1
      `,
      [
        raffleId,
        winner.ticket_number,
        winner.colour,
        winner.sale_id,
      ]
    );

    if (winner.buyer_email) {
      try {
        await sendWinnerEmail({
          to: winner.buyer_email,
          name: winner.buyer_name,
          raffleTitle: raffle.title,
          ticketNumber: winner.ticket_number,
          colour: winner.colour,
        });
      } catch (err) {
        console.error("email failed", err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("ADMIN ACTION ERROR:", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
