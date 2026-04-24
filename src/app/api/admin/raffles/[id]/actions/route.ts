import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { closeRaffle, deleteRaffle, getRaffleById } from "@/lib/raffles";
import { query, queryOne } from "@/lib/db";
import { sendWinnerEmail } from "@/lib/email";

type Body = {
  action?: "close" | "draw" | "delete";
  winnerCount?: number;
};

type SoldTicketRow = {
  sale_id: string;
  ticket_number: number;
  colour: string | null;
  buyer_email: string | null;
  buyer_name: string | null;
};

function ordinal(position: number) {
  const suffix =
    position % 10 === 1 && position % 100 !== 11
      ? "st"
      : position % 10 === 2 && position % 100 !== 12
        ? "nd"
        : position % 10 === 3 && position % 100 !== 13
          ? "rd"
          : "th";

  return `${position}${suffix}`;
}

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

    const body = (await request.json()) as Body;
    const raffleId = params.id;

    const raffle = await getRaffleById(raffleId);

    if (!raffle) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 }
      );
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

    if (raffle.status !== "closed") {
      return NextResponse.json(
        { ok: false, error: "Only closed raffles can be drawn." },
        { status: 400 }
      );
    }

    const existingWinner = await queryOne<{ count: string | number }>(
      `
      select count(*)::int as count
      from raffle_winners
      where raffle_id = $1
      `,
      [raffleId]
    );

    if (Number(existingWinner?.count ?? 0) > 0 || raffle.drawn_at) {
      return NextResponse.json(
        { ok: false, error: "Winner already drawn." },
        { status: 400 }
      );
    }

    const requestedWinnerCount = Math.max(
      1,
      Math.floor(Number(body.winnerCount || 1))
    );

    const soldTickets = await query<SoldTicketRow>(
      `
      select
        id::text as sale_id,
        ticket_number::int as ticket_number,
        colour::text as colour,
        buyer_email,
        buyer_name
      from raffle_ticket_reservations
      where raffle_id = $1
        and status = 'sold'
      order by created_at asc
      `,
      [raffleId]
    );

    if (!soldTickets.length) {
      return NextResponse.json(
        { ok: false, error: "No sold tickets found" },
        { status: 400 }
      );
    }

    const winnerCount = Math.min(requestedWinnerCount, soldTickets.length);
    const available = [...soldTickets];
    const winners: SoldTicketRow[] = [];

    for (let i = 0; i < winnerCount; i += 1) {
      const index = crypto.randomInt(0, available.length);
      const [winner] = available.splice(index, 1);
      winners.push(winner);
    }

    for (let i = 0; i < winners.length; i += 1) {
      const winner = winners[i];
      const prizePosition = i + 1;

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
        values ($1, $2, $3, $4, $5, $6, $7, now())
        `,
        [
          raffleId,
          prizePosition,
          winner.ticket_number,
          winner.colour,
          winner.sale_id,
          winner.buyer_name,
          winner.buyer_email,
        ]
      );
    }

    const firstWinner = winners[0];

    await query(
      `
      update raffles
      set
        status = 'drawn',
        winner_ticket_number = $2,
        winner_colour = $3,
        winner_sale_id = $4,
        drawn_at = now(),
        drawn_by = $5,
        updated_at = now()
      where id = $1
      `,
      [
        raffleId,
        firstWinner.ticket_number,
        firstWinner.colour,
        firstWinner.sale_id,
        session.user?.email ?? null,
      ]
    );

    const emailResults: Array<{
      prizePosition: number;
      emailSent: boolean;
      emailError: string | null;
    }> = [];

    for (let i = 0; i < winners.length; i += 1) {
      const winner = winners[i];
      const prizePosition = i + 1;

      let emailSent = false;
      let emailError: string | null = null;

      try {
        if (winner.buyer_email) {
          await sendWinnerEmail({
            to: winner.buyer_email,
            name: winner.buyer_name,
            raffleTitle: `${raffle.title} - ${ordinal(prizePosition)} prize`,
            ticketNumber: winner.ticket_number,
            colour: winner.colour,
          });

          emailSent = true;
        } else {
          emailError = "Winner email address not found";
        }
      } catch (error: any) {
        console.error("winner email failed", error);
        emailError = error?.message || "Winner email failed";
      }

      emailResults.push({
        prizePosition,
        emailSent,
        emailError,
      });
    }

    const updated = await getRaffleById(raffleId);

    return NextResponse.json({
      ok: true,
      raffle: updated,
      winners: winners.map((winner, index) => ({
        prizePosition: index + 1,
        ticketNumber: winner.ticket_number,
        colour: winner.colour,
        buyerEmail: winner.buyer_email,
        buyerName: winner.buyer_name,
      })),
      emailResults,
    });
  } catch (error: any) {
    console.error("DRAW ACTION ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
