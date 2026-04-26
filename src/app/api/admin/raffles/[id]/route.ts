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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await auth();
    if (!user) {
      return NextResponse.redirect(
        new URL("/admin/login", req.url),
        { status: 303 }
      );
    }

    const tenantSlug = getTenantSlugFromHeaders();

    const raffle = await getRaffleById(params.id);
    if (!raffle || raffle.tenant_slug !== tenantSlug) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const formData = await req.formData();

    // --------------------------
    // BASIC FIELDS
    // --------------------------
    const title = String(formData.get("title") || "");
    const slug = String(formData.get("slug") || "");
    const description = String(formData.get("description") || "");
    const image_url = String(formData.get("image_url") || "");

    const ticket_price = Number(formData.get("ticket_price") || 0);
    const ticket_price_cents = Math.round(ticket_price * 100);

    const total_tickets =
      Number(formData.get("endNumber")) -
      Number(formData.get("startNumber")) +
      1;

    const status = String(formData.get("status") || "draft");
    const currency = String(formData.get("currency") || "GBP");

    // --------------------------
    // COLOURS
    // --------------------------
    const preset = formData.getAll("colour_preset").map(String);
    const custom = String(formData.get("custom_colours") || "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    const colours = [...preset, ...custom].map((c, i) => ({
      id: `colour-${i + 1}`,
      name: c,
      hex: c.startsWith("#") ? c : c.toLowerCase(),
      sortOrder: i
    }));

    // --------------------------
    // OFFERS
    // --------------------------
    const offerCount = Number(formData.get("offer_count") || 0);
    const offers: any[] = [];

    for (let i = 0; i < offerCount; i++) {
      const quantity = Number(formData.get(`offer_quantity_${i}`));
      const price = Number(formData.get(`offer_price_${i}`));
      const active = formData.get(`offer_active_${i}`) === "true";

      if (quantity > 0 && price > 0) {
        offers.push({
          id: `offer-${i + 1}`,
          label: `${quantity} for ${price}`,
          price,
          quantity,
          tickets: quantity,
          isActive: active,
          sortOrder: i
        });
      }
    }

    // --------------------------
    // UPDATE
    // --------------------------
    await updateRaffle(params.id, tenantSlug, {
      title,
      slug,
      description,
      image_url,
      ticket_price_cents,
      total_tickets,
      status: status as any,
      currency: currency as any
    });

    await updateRaffleOffers(params.id, tenantSlug, offers);
    await updateRaffleColours(params.id, tenantSlug, colours);

    // prizes handled separately via PrizeSettings component

    // ✅ FIXED: absolute redirect
    return NextResponse.redirect(
      new URL(`/admin/raffles/${params.id}`, req.url),
      { status: 303 }
    );

  } catch (err: any) {
    console.error("POST raffle error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
