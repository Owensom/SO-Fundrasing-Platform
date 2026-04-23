import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  closeRaffle,
  deleteRaffle,
  getRaffleById,
  getSoldTicketsForDraw,
  setRaffleWinner,
} from "@/lib/raffles";
import { queryOne } from "@/lib/db";
import { sendWinnerEmail } from "@/lib/email";

type Body = {
  action?: "close" | "draw" | "delete";
};

type WinnerRow = {
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

    const soldTickets = await getSoldTicketsForDraw(raffleId);

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

    const winnerRow = await queryOne<WinnerRow>(
      `
      select buyer_email, buyer_name
      from raffle_ticket_sales
      where id = $1
      limit 1
      `,
      [winner.sale_id]
    );

    let emailSent = false;
    let emailError: string | null = null;

    try {
      if (winnerRow?.buyer_email) {
        await sendWinnerEmail({
          to: winnerRow.buyer_email,
          name: winnerRow.buyer_name,
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
      emailSent,
      emailError,
    });
  } catch (error: any) {
    console.error("DRAW ACTION ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Unknown error",
        stack: error?.stack || null,
      },
      { status: 500 }
    );
  }
}
