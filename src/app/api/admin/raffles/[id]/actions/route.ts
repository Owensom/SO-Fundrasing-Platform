import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import {
  deleteRaffle,
  getRaffleById,
  closeRaffle,
  setRaffleWinner,
  getSoldTicketsForDraw,
} from "@/lib/raffles";

export const runtime = "nodejs";

// ----------------------
// POST (close / draw / delete)
// ----------------------
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await auth();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const tenantSlug = getTenantSlugFromHeaders();

    const raffle = await getRaffleById(params.id);
    if (!raffle || raffle.tenant_slug !== tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 },
      );
    }

    const body = await req.json();
    const action = String(body?.action || "");

    // ----------------------
    // CLOSE
    // ----------------------
    if (action === "close") {
      const updated = await closeRaffle(raffle.id);

      if (!updated) {
        return NextResponse.json(
          { ok: false, error: "Unable to close raffle" },
          { status: 400 },
        );
      }

      return NextResponse.json({ ok: true });
    }

    // ----------------------
    // DRAW
    // ----------------------
    if (action === "draw") {
      const tickets = await getSoldTicketsForDraw(raffle.id);

      if (!tickets.length) {
        return NextResponse.json(
          { ok: false, error: "No tickets sold" },
          { status: 400 },
        );
      }

      const winner = tickets[Math.floor(Math.random() * tickets.length)];

      const updated = await setRaffleWinner({
        raffleId: raffle.id,
        ticketNumber: winner.ticket_number,
        colour: winner.colour,
        saleId: winner.sale_id,
        drawnBy: user?.user?.email ?? null,
      });

      if (!updated) {
        return NextResponse.json(
          { ok: false, error: "Unable to draw winner" },
          { status: 400 },
        );
      }

      return NextResponse.json({ ok: true });
    }

    // ----------------------
    // DELETE
    // ----------------------
    if (action === "delete") {
      await deleteRaffle(raffle.id, tenantSlug);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid action" },
      { status: 400 },
    );
  } catch (err: any) {
    console.error("raffle action error", err);

    return NextResponse.json(
      { ok: false, error: err?.message || "Action failed" },
      { status: 500 },
    );
  }
}
