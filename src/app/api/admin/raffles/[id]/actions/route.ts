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

    if (!body.action || (body.action !== "close" && body.action !== "draw")) {
      return NextResponse.json(
        { ok: false, error: "Invalid action" },
        { status: 400 }
      );
    }

    const raffle = await getRaffleById(raffleId);

    if (!raffle) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 }
      );
    }

    const userEmail =
      typeof session.user?.email === "string" ? session.user.email : null;

    if (body.action === "close") {
      if (raffle.status !== "published") {
        return NextResponse.json(
          { ok: false, error: "Only published raffles can be closed." },
          { status: 400 }
        );
      }

      const updated = await closeRaffle(raffleId);

      if (!updated) {
        return NextResponse.json(
          { ok: false, error: "Failed to close raffle." },
          { status: 400 }
        );
      }

      return NextResponse.json({ ok: true, raffle: updated });
    }

    if (raffle.status !== "closed") {
      return NextResponse.json(
        { ok: false, error: "Only closed raffles can draw a winner." },
        { status: 400 }
      );
    }

    if (raffle.drawn_at) {
      return NextResponse.json(
        { ok: false, error: "Winner already drawn." },
        { status: 400 }
      );
    }

    const soldTickets = await getSoldTicketsForDraw(raffleId);

    if (!soldTickets.length) {
      return NextResponse.json(
        { ok: false, error: "No sold tickets available for draw." },
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
      drawnBy: userEmail,
    });

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Failed to store drawn winner." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, raffle: updated });
  } catch (error) {
    console.error("raffle action error", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
