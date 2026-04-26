import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import { createRaffle, listRaffles } from "../../../../../api/_lib/raffles-repo";

export const runtime = "nodejs";

function parseNumber(
  value: FormDataEntryValue | string | null | undefined,
  fallback = 0,
) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseColours(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOffers(value: string) {
  if (!value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
    const items = await listRaffles(tenantSlug);

    return NextResponse.json({
      ok: true,
      items,
    });
  } catch (error) {
    console.error("GET /api/admin/raffles failed", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const tenantSlug =
      getTenantSlugFromRequest(request) ||
      String(formData.get("tenantSlug") ?? "").trim();

    if (!tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Tenant not found" },
        { status: 404 },
      );
    }

    const title = String(formData.get("title") ?? "").trim();
    const rawSlug = String(formData.get("slug") ?? "").trim();
    const slug = slugify(rawSlug || title);
    const description = String(formData.get("description") ?? "").trim();
    const image_url = String(formData.get("image_url") ?? "").trim();
    const currency = String(formData.get("currency") ?? "EUR").trim();
    const status = String(formData.get("status") ?? "draft").trim();

    const ticket_price = parseNumber(formData.get("ticket_price"), 0);
    const startNumber = parseNumber(formData.get("startNumber"), 1);
    const endNumber = parseNumber(formData.get("endNumber"), 1);

    const colours = parseColours(String(formData.get("colours") ?? ""));
    const offers = parseOffers(String(formData.get("offers") ?? "[]"));

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

    const numbersPerColour =
      colours.length > 0 && endNumber >= startNumber
        ? endNumber - startNumber + 1
        : 0;

    const total_tickets = numbersPerColour * colours.length;

    const raffle = await createRaffle({
      tenant_slug: tenantSlug,
      title,
      slug,
      description,
      image_url,
      currency: currency as "GBP" | "USD" | "EUR",
      ticket_price,
      total_tickets,
      sold_tickets: 0,
      status: status as "draft" | "published" | "closed" | "drawn",
      startNumber,
      endNumber,
      numbersPerColour,
      colourCount: colours.length,
      colours,
      offers,
      sold: [],
      reserved: [],
    });

    return NextResponse.redirect(
      new URL(`/admin/raffles/${raffle.id}`, request.url),
      { status: 303 },
    );
  } catch (error) {
    console.error("POST /api/admin/raffles failed", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
