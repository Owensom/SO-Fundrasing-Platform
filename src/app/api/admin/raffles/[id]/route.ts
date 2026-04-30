import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { queryOne } from "@/lib/db";
import {
  getRaffleById,
  updateRaffle,
  updateRaffleOffers,
  updateRaffleColours,
  updateRaffleImagePosition,
} from "@/lib/raffles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normaliseImagePosition(value: unknown) {
  const clean = String(value ?? "").trim().toLowerCase();

  if (
    clean === "center" ||
    clean === "top" ||
    clean === "bottom" ||
    clean === "left" ||
    clean === "right"
  ) {
    return clean;
  }

  return "center";
}

function parsePositiveInteger(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await auth();

    if (!user) {
      return NextResponse.redirect(new URL("/admin/login", req.url), {
        status: 303,
      });
    }

    const tenantSlug = getTenantSlugFromHeaders();

    const raffle = await getRaffleById(params.id);

    if (!raffle || raffle.tenant_slug !== tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Not found" },
        { status: 404 },
      );
    }

    const formData = await req.formData();

    const title = String(formData.get("title") || "");
    const slug = String(formData.get("slug") || "");
    const description = String(formData.get("description") || "");
    const image_url = String(formData.get("image_url") || "");
    const image_position = normaliseImagePosition(
      formData.get("image_position"),
    );

    const rawDrawAt = String(formData.get("draw_at") || "").trim();
    const draw_at = rawDrawAt ? rawDrawAt : null;

    const ticket_price = Number(formData.get("ticket_price") || 0);
    const ticket_price_cents = Math.round(ticket_price * 100);

    const startNumber = Number(formData.get("startNumber") || 1);
    const endNumber = Number(formData.get("endNumber") || 1);
    const total_tickets = Math.max(0, endNumber - startNumber + 1);

    const autoDrawFromPrize = parsePositiveInteger(
      formData.get("auto_draw_from_prize"),
      1,
    );

    const autoDrawToPrize = parsePositiveInteger(
      formData.get("auto_draw_to_prize"),
      999,
    );

    const status = String(formData.get("status") || "draft");
    const currency = String(formData.get("currency") || "GBP");

    const preset = formData.getAll("colour_preset").map(String);

    const custom = String(formData.get("custom_colours") || "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    const colours = [...preset, ...custom].map((c, i) => ({
      id: `colour-${i + 1}`,
      name: c,
      hex: c.startsWith("#") ? c : c.toLowerCase(),
      sortOrder: i,
    }));

    const offerCount = Number(formData.get("offer_count") || 0);
    const offers: any[] = [];

    for (let i = 0; i < offerCount; i += 1) {
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
          sortOrder: i,
        });
      }
    }

    await updateRaffle(params.id, tenantSlug, {
      title,
      slug,
      description,
      image_url,
      draw_at,
      ticket_price_cents,
      total_tickets,
      status: status as any,
      currency: currency as any,
    });

    await updateRaffleOffers(params.id, tenantSlug, offers);
    await updateRaffleColours(params.id, tenantSlug, colours);
    await updateRaffleImagePosition(params.id, tenantSlug, image_position);

    await queryOne(
      `
      update raffles
      set
        config_json = jsonb_set(
          jsonb_set(
            coalesce(config_json, '{}'::jsonb),
            '{auto_draw_from_prize}',
            to_jsonb($3::int),
            true
          ),
          '{auto_draw_to_prize}',
          to_jsonb($4::int),
          true
        ),
        updated_at = now()
      where id = $1
        and tenant_slug = $2
      returning id
      `,
      [params.id, tenantSlug, autoDrawFromPrize, autoDrawToPrize],
    );

    return NextResponse.redirect(
      new URL(`/admin/raffles/${params.id}`, req.url),
      { status: 303 },
    );
  } catch (err: any) {
    console.error("POST raffle error:", err);

    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 },
    );
  }
}
