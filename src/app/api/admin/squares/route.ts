import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import {
  createSquaresGame,
  listSquaresGames,
  normalisePrizes,
  slugify,
} from "../../../../../api/_lib/squares-repo";

function parseNumber(
  value: FormDataEntryValue | string | null | undefined,
  fallback = 0,
) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parsePrizesJson(value: string) {
  if (!value.trim()) return [];

  try {
    return normalisePrizes(JSON.parse(value));
  } catch {
    return [];
  }
}

function parsePrizeTable(formData: FormData) {
  const titles = formData.getAll("prize_title").map((v) => String(v).trim());
  const descriptions = formData
    .getAll("prize_description")
    .map((v) => String(v).trim());

  const prizes = titles
    .map((title, index) => {
      if (!title) return null;

      return {
        title,
        name: title,
        description: descriptions[index] ?? "",
        position: index + 1,
        sort_order: index + 1,
        is_public: true,
      };
    })
    .filter(Boolean);

  return normalisePrizes(prizes);
}

function parsePrizes(formData: FormData) {
  const tablePrizes = parsePrizeTable(formData);

  if (tablePrizes.length > 0) {
    return tablePrizes;
  }

  return parsePrizesJson(String(formData.get("prizes") ?? "[]"));
}

function parseDrawAt(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export async function GET(request: NextRequest) {
  const tenantSlug = getTenantSlugFromRequest(request);

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  try {
    const items = await listSquaresGames(tenantSlug);

    return NextResponse.json({
      ok: true,
      items,
    });
  } catch (error) {
    console.error("GET admin squares failed:", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const tenantSlug = getTenantSlugFromRequest(request);

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  try {
    const formData = await request.formData();

    const title = String(formData.get("title") ?? "").trim();
    const rawSlug = String(formData.get("slug") ?? "").trim();
    const slug = slugify(rawSlug || title);

    if (!title) {
      return NextResponse.json(
        { ok: false, error: "Title is required" },
        { status: 400 },
      );
    }

    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "Slug is required" },
        { status: 400 },
      );
    }

    const description = String(formData.get("description") ?? "").trim();
    const image_url = String(formData.get("image_url") ?? "").trim();
    const draw_at = parseDrawAt(formData.get("draw_at"));

    const currency = String(formData.get("currency") ?? "GBP") as
      | "GBP"
      | "USD"
      | "EUR";

    const status = String(formData.get("status") ?? "draft") as
      | "draft"
      | "published"
      | "closed"
      | "drawn";

    const total_squares = Math.min(
      500,
      Math.max(1, parseNumber(formData.get("total_squares"), 100)),
    );

    const priceMajor = parseNumber(formData.get("price_per_square"), 0);
    const price_per_square_cents = Math.max(0, Math.round(priceMajor * 100));

    const prizes = parsePrizes(formData);

    const created = await createSquaresGame({
      tenant_slug: tenantSlug,
      title,
      slug,
      description,
      image_url,
      draw_at,
      currency,
      status,
      total_squares,
      price_per_square_cents,
      prizes,
    });

    if (!created) {
      return NextResponse.json(
        { ok: false, error: "Create failed" },
        { status: 500 },
      );
    }

    return NextResponse.redirect(
      new URL(`/admin/squares/${created.id}`, request.url),
      { status: 303 },
    );
  } catch (error) {
    console.error("POST admin squares failed:", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
