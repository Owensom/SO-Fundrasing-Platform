import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  closeRaffle,
  deleteRaffle,
  getRaffleById,
  setRaffleWinner,
} from "@/lib/raffles";
import { query } from "@/lib/db";
import { sendWinnerEmail } from "@/lib/email";

type Body = {
  action?: "close" | "draw" | "delete";
};

type SoldTicketRow = {
  sale_id: string;
  ticket_number: number;
  colour: string | null;
  buyer_email: string | null;
  buyer_name: string | null;
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

    const winnerIndex = crypto.randomInt(0, soldTickets.length);
    const winner = soldTickets[winnerIndex];

    const updated = await setRaffleWinner({
      raffleId,
      ticketNumber: winner.ticket_number,
      colour: winner.colour ?? null,
      saleId: winner.sale_id,
      drawnBy: session.user?.email ?? null,
    });

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Failed to set winner" },
        { status: 500 }
      );
    }

    let emailSent = false;
    let emailError: string | null = null;

    try {
      if (winner.buyer_email) {
        await sendWinnerEmail({
          to: winner.buyer_email,
          name: winner.buyer_name,
          raffleTitle: updated.title,
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

    return NextResponse.json({
      ok: true,
      raffle: updated,
      winner: {
        ticketNumber: winner.ticket_number,
        colour: winner.colour,
        buyerEmail: winner.buyer_email,
        buyerName: winner.buyer_name,
      },
      emailSent,
      emailError,
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
