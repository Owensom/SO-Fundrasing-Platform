import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import {
  getSquaresGameById,
  normalisePrizes,
  updateSquaresGame,
  slugify,
} from "../../../../../../../api/_lib/squares-repo";

type RouteContext = {
  params: {
    id: string;
  };
};

function parseNumber(
  value: FormDataEntryValue | string | null | undefined,
  fallback = 0,
) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parsePrizeRows(formData: FormData) {
  const titles = formData.getAll("prize_title");
  const descriptions = formData.getAll("prize_description");

  return normalisePrizes(
    titles.map((title, index) => ({
      title: String(title ?? "").trim(),
      description: String(descriptions[index] ?? "").trim(),
    })),
  );
}

function parseDrawAt(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

export async function GET(request: NextRequest, context: RouteContext) {
  const tenantSlug = getTenantSlugFromRequest(request);
  const id = context.params.id;

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  try {
    const game = await getSquaresGameById(id);

    if (!game) {
      return NextResponse.json(
        { ok: false, error: "Squares game not found" },
        { status: 404 },
      );
    }

    if (game.tenant_slug !== tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    return NextResponse.json({ ok: true, item: game });
  } catch (error) {
    console.error("GET admin square failed:", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const tenantSlug = getTenantSlugFromRequest(request);
  const id = context.params.id;

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  try {
    const existing = await getSquaresGameById(id);

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Squares game not found" },
        { status: 404 },
      );
    }

    if (existing.tenant_slug !== tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const formData = await request.formData();

    const title = String(formData.get("title") ?? existing.title).trim();
    const rawSlug = String(formData.get("slug") ?? existing.slug).trim();
    const slug = slugify(rawSlug || existing.slug);

    const description = String(formData.get("description") ?? "").trim();
    const image_url = String(formData.get("image_url") ?? "").trim();

    const currency = String(formData.get("currency") ?? existing.currency ?? "GBP") as
      | "GBP"
      | "USD"
      | "EUR";

    const status = String(formData.get("status") ?? existing.status) as
      | "draft"
      | "published"
      | "closed"
      | "drawn";

    const total_squares = Math.min(
      500,
      Math.max(1, parseNumber(formData.get("total_squares"), existing.total_squares)),
    );

    const priceMajor = parseNumber(
      formData.get("price_per_square"),
      existing.price_per_square_cents / 100,
    );

    const price_per_square_cents = Math.round(priceMajor * 100);

    const prizes = parsePrizeRows(formData);

    const currentConfig = existing.config_json ?? {};

    const auto_draw_from_prize = Math.max(
      1,
      Math.floor(parseNumber(formData.get("auto_draw_from_prize"), 1)),
    );

    const auto_draw_to_prize = Math.max(
      auto_draw_from_prize,
      Math.floor(parseNumber(formData.get("auto_draw_to_prize"), 999)),
    );

    const updated = await updateSquaresGame(id, {
      tenant_slug: tenantSlug,
      title: title || existing.title,
      slug: slug || existing.slug,
      description,
      image_url,
      draw_at: parseDrawAt(formData.get("draw_at")),
      currency,
      status,
      total_squares,
      price_per_square_cents,
      prizes,
      sold: currentConfig.sold ?? [],
      reserved: currentConfig.reserved ?? [],
      auto_draw_from_prize,
      auto_draw_to_prize,
    } as any);

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Update failed" },
        { status: 500 },
      );
    }

    return NextResponse.redirect(new URL(`/admin/squares/${id}`, request.url), {
      status: 303,
    });
  } catch (error) {
    console.error("POST admin square failed:", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const tenantSlug = getTenantSlugFromRequest(request);
  const id = context.params.id;

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  try {
    const existing = await getSquaresGameById(id);

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Squares game not found" },
        { status: 404 },
      );
    }

    if (existing.tenant_slug !== tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const currentConfig = existing.config_json ?? {};

    const totalSquares =
      body?.total_squares != null
        ? Math.min(500, Math.max(1, Number(body.total_squares)))
        : existing.total_squares;

    const autoDrawFrom = Math.max(
      1,
      Math.floor(Number(body?.auto_draw_from_prize ?? currentConfig.auto_draw_from_prize ?? 1)),
    );

    const autoDrawTo = Math.max(
      autoDrawFrom,
      Math.floor(Number(body?.auto_draw_to_prize ?? currentConfig.auto_draw_to_prize ?? 999)),
    );

    const updated = await updateSquaresGame(id, {
      tenant_slug: tenantSlug,
      title: String(body?.title ?? existing.title),
      slug: slugify(String(body?.slug ?? existing.slug)),
      description: String(body?.description ?? existing.description ?? ""),
      image_url: String(body?.image_url ?? existing.image_url ?? ""),
      draw_at: body?.draw_at ?? existing.draw_at ?? null,
      currency: body?.currency ?? existing.currency ?? "GBP",
      status: body?.status ?? existing.status,
      total_squares: totalSquares,
      price_per_square_cents:
        body?.price_per_square_cents != null
          ? Number(body.price_per_square_cents)
          : existing.price_per_square_cents,
      prizes: Array.isArray(body?.prizes)
        ? normalisePrizes(body.prizes)
        : normalisePrizes(currentConfig.prizes ?? []),
      sold: currentConfig.sold ?? [],
      reserved: currentConfig.reserved ?? [],
      auto_draw_from_prize: autoDrawFrom,
      auto_draw_to_prize: autoDrawTo,
    } as any);

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Update failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, item: updated });
  } catch (error) {
    console.error("PUT admin square failed:", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
