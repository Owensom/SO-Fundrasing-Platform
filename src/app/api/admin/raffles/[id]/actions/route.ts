import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  closeRaffle,
  getRaffleById,
  getSoldTicketsForDraw,
  setRaffleWinner,
} from "@/lib/raffles";

type Body = {
  action?: "close" | "draw";
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

    console.log("ACTION:", body.action);
    console.log("RAFFLE ID:", raffleId);

    const raffle = await getRaffleById(raffleId);

    if (!raffle) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 }
      );
    }

    console.log("RAFFLE STATUS:", raffle.status);

    if (body.action === "close") {
      const updated = await closeRaffle(raffleId);
      return NextResponse.json({ ok: true, raffle: updated });
    }

    // ===== DRAW =====

    const soldTickets = await getSoldTicketsForDraw(raffleId);

    console.log("SOLD TICKETS:", soldTickets);

    if (!soldTickets.length) {
      return NextResponse.json(
        { ok: false, error: "No sold tickets found" },
        { status: 400 }
      );
    }

    const winnerIndex = crypto.randomInt(0, soldTickets.length);
    const winner = soldTickets[winnerIndex];

    console.log("WINNER PICKED:", winner);

    const updated = await setRaffleWinner({
      raffleId,
      ticketNumber: winner.ticket_number,
      colour: winner.colour ?? null,
      saleId: winner.sale_id,
      drawnBy: session.user?.email ?? null,
    });

    console.log("UPDATED RESULT:", updated);

    return NextResponse.json({ ok: true, raffle: updated });
  } catch (error: any) {
    console.error("🔥 DRAW ERROR:", error);

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
