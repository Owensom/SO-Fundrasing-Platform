// src/app/api/admin/raffles/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import {
  getRaffleById,
  updateRaffle,
  updateRaffleOffers,
  updateRaffleColours,
  updateRafflePrizes
} from "@/lib/raffles";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Authenticate admin
    const user = await auth();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // Multi-tenant
    const tenantSlug = getTenantSlugFromHeaders();

    // Fetch current raffle
    const raffle = await getRaffleById(params.id);
    if (!raffle || raffle.tenant_slug !== tenantSlug) {
      return NextResponse.json({ ok: false, error: "Raffle not found" }, { status: 404 });
    }

    const body = await req.json();

    // ------------------------------
    // Update main raffle fields
    // ------------------------------
    const updatedRaffle = await updateRaffle(params.id, tenantSlug, {
      title: body.title,
      description: body.description,
      ticket_price_cents: body.ticket_price_cents,
      total_tickets: body.total_tickets,
      status: body.status
    });

    // ------------------------------
    // Update offers if provided
    // ------------------------------
    let updatedOffers = raffle.offers;
    if (body.offers) {
      updatedOffers = await updateRaffleOffers(params.id, tenantSlug, body.offers);
    }

    // ------------------------------
    // Update colours if provided
    // ------------------------------
    let updatedColours = raffle.colours;
    if (body.colours) {
      updatedColours = await updateRaffleColours(params.id, tenantSlug, body.colours);
    }

    // ------------------------------
    // Update prizes if provided
    // ------------------------------
    let updatedPrizes = raffle.prizes || [];
    if (body.prizes) {
      updatedPrizes = await updateRafflePrizes(params.id, tenantSlug, body.prizes);
    }

    // ------------------------------
    // Return full updated raffle object for frontend
    // ------------------------------
    return NextResponse.json({
      ok: true,
      raffle: {
        ...updatedRaffle,
        offers: updatedOffers,
        colours: updatedColours,
        prizes: updatedPrizes
      }
    });
  } catch (err: any) {
    console.error("Update raffle error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
