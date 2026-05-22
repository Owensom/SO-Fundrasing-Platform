import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import { query, queryOne } from "@/lib/db";
import { getSquaresGameByTenantAndSlug } from "../../../../../../api/_lib/squares-repo";

type PublicSquaresWinnerRow = {
  id: string;
  prize_title: string;
  square_number: number;
  customer_name: string | null;
};

type TenantBrandingRow = {
  public_display_name: string | null;
  public_tagline: string | null;
  public_logo_url: string | null;
  public_logo_mark_url: string | null;
  public_primary_colour: string | null;
  public_accent_colour: string | null;
  public_footer_text: string | null;
};

function normaliseFocus(value: unknown, fallback = 50) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normaliseHexColour(value: unknown, fallback: string) {
  const clean = cleanText(value).toUpperCase();

  if (/^#[0-9A-F]{6}$/.test(clean)) {
    return clean;
  }

  return fallback;
}

async function getTenantBranding(tenantSlug: string) {
  const branding = await queryOne<TenantBrandingRow>(
    `
      select
        public_display_name,
        public_tagline,
        public_logo_url,
        public_logo_mark_url,
        public_primary_colour,
        public_accent_colour,
        public_footer_text
      from tenant_settings
      where tenant_slug = $1
      limit 1
    `,
    [tenantSlug],
  );

  return {
    displayName: cleanText(branding?.public_display_name),
    tagline: cleanText(branding?.public_tagline),
    logoUrl: cleanText(branding?.public_logo_url),
    logoMarkUrl: cleanText(branding?.public_logo_mark_url),
    primaryColour: normaliseHexColour(
      branding?.public_primary_colour,
      "#2563EB",
    ),
    accentColour: normaliseHexColour(
      branding?.public_accent_colour,
      "#F59E0B",
    ),
    footerText: cleanText(branding?.public_footer_text),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const tenantSlug = getTenantSlugFromRequest(request);

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  try {
    const game = await getSquaresGameByTenantAndSlug(tenantSlug, params.slug);

    if (!game) {
      return NextResponse.json(
        { ok: false, error: "Squares game not found" },
        { status: 404 },
      );
    }

    const config = (game.config_json ?? {}) as any;

    const imageFocusX = normaliseFocus(config.image_focus_x, 50);
    const imageFocusY = normaliseFocus(config.image_focus_y, 50);

    const [winners, branding] = await Promise.all([
      query<PublicSquaresWinnerRow>(
        `
          select
            id,
            prize_title,
            square_number,
            customer_name
          from squares_winners
          where tenant_slug = $1
            and game_id = $2
          order by prize_index asc, created_at asc
        `,
        [tenantSlug, game.id],
      ),
      getTenantBranding(tenantSlug),
    ]);

    return NextResponse.json({
      ok: true,
      game: {
        id: game.id,
        tenantSlug: game.tenant_slug,
        slug: game.slug,
        title: game.title,
        description: game.description ?? "",
        imageUrl: game.image_url ?? "",
        imageFocusX,
        imageFocusY,
        image_focus_x: imageFocusX,
        image_focus_y: imageFocusY,
        drawAt: game.draw_at,
        status: game.status,
        currency: game.currency ?? "GBP",
        pricePerSquareCents: game.price_per_square_cents,
        totalSquares: game.total_squares,
        prizes: Array.isArray(config.prizes) ? config.prizes : [],
        soldSquares: Array.isArray(config.sold) ? config.sold : [],
        reservedSquares: Array.isArray(config.reserved)
          ? config.reserved
          : [],
        winners: winners.map((winner) => ({
          id: winner.id,
          prize_title: winner.prize_title,
          square_number: Number(winner.square_number),
          customer_name: winner.customer_name,
        })),
        question: config.question ?? null,
        freeEntry: config.free_entry
          ? {
              address: config.free_entry.address ?? "",
              instructions: config.free_entry.instructions ?? "",
              closes_at: config.free_entry.closes_at ?? null,
              closesAt: config.free_entry.closes_at ?? null,
            }
          : null,
        branding,
      },
    });
  } catch (error) {
    console.error("GET public squares failed:", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
