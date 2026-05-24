import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import { queryOne } from "@/lib/db";
import { getTenantSettings } from "@/lib/tenant-settings";
import { canPublishAnotherCampaign } from "@/lib/subscription-capabilities";
import { createRaffle, listRaffles } from "../../../../../api/_lib/raffles-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseNumber(
  value: FormDataEntryValue | string | null | undefined,
  fallback = 0,
) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normaliseFocus(
  value: FormDataEntryValue | string | null | undefined,
  fallback = 50,
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normaliseRaffleSubtype(value: FormDataEntryValue | string | null) {
  const clean = String(value ?? "").trim().toLowerCase();

  if (clean === "fifty_fifty") return "fifty_fifty";

  return "standard";
}

function parseColours(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonArray(value: string) {
  if (!value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseLegalQuestion(value: string) {
  if (!value.trim()) return null;

  try {
    const parsed = JSON.parse(value);

    if (!parsed || typeof parsed !== "object") return null;

    const text = String(parsed.text ?? "").trim();
    const answer = String(parsed.answer ?? "").trim();

    if (!text || !answer) return null;

    return { text, answer };
  } catch {
    return null;
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

function normaliseImagePosition(value: string) {
  const clean = value.trim().toLowerCase();

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

function normaliseDrawAt(value: FormDataEntryValue | null) {
  const clean = String(value ?? "").trim();
  return clean ? clean : null;
}

async function requireTenantAccess(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  const tenantSlug = getTenantSlugFromRequest(request);

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Tenant access denied" },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true as const,
    tenantSlug,
  };
}

async function canTenantPublishCampaign(tenantSlug: string) {
  const activeCampaignCounts = await queryOne<{
    total: number;
  }>(
    `
      select (
        (
          select count(*)
          from raffles
          where tenant_slug = $1
            and status = 'published'
        ) +
        (
          select count(*)
          from squares_games
          where tenant_slug = $1
            and status = 'published'
        ) +
        (
          select count(*)
          from events
          where tenant_slug = $1
            and status = 'published'
        )
      )::int as total
    `,
    [tenantSlug],
  );

  const currentActiveCampaigns = Number(activeCampaignCounts?.total || 0);
  const tenantSettings = await getTenantSettings(tenantSlug);

  return canPublishAnotherCampaign({
    subscription_tier: tenantSettings?.subscription_tier,
    currentActiveCampaigns,
  });
}

export async function GET(request: NextRequest) {
  const access = await requireTenantAccess(request);

  if (!access.ok) {
    return access.response;
  }

  try {
    const items = await listRaffles(access.tenantSlug);

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
    const access = await requireTenantAccess(request);

    if (!access.ok) {
      return access.response;
    }

    const tenantSlug = access.tenantSlug;
    const formData = await request.formData();

    const submittedTenantSlug = String(formData.get("tenantSlug") ?? "").trim();

    if (submittedTenantSlug && submittedTenantSlug !== tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Tenant access denied" },
        { status: 403 },
      );
    }

    const title = String(formData.get("title") ?? "").trim();
    const rawSlug = String(formData.get("slug") ?? "").trim();
    const slug = slugify(rawSlug || title);
    const description = String(formData.get("description") ?? "").trim();
    const image_url = String(formData.get("image_url") ?? "").trim();
    const draw_at = normaliseDrawAt(formData.get("draw_at"));

    const image_position = normaliseImagePosition(
      String(formData.get("image_position") ?? "center"),
    );

    const image_focus_x = normaliseFocus(formData.get("image_focus_x"), 50);
    const image_focus_y = normaliseFocus(formData.get("image_focus_y"), 50);

    const currency = String(formData.get("currency") ?? "GBP").trim();
    const status = String(formData.get("status") ?? "draft").trim();
    const raffle_subtype = normaliseRaffleSubtype(
      formData.get("raffle_subtype"),
    );

    if (status === "published") {
      const allowedToPublish = await canTenantPublishCampaign(tenantSlug);

      if (!allowedToPublish) {
        return NextResponse.redirect(
          new URL("/admin/raffles/new?error=campaign_limit", request.url),
          { status: 303 },
        );
      }
    }

    const ticket_price = parseNumber(formData.get("ticket_price"), 0);
    const startNumber = parseNumber(formData.get("startNumber"), 1);
    const endNumber = parseNumber(formData.get("endNumber"), 1);

    const colours = parseColours(String(formData.get("colours") ?? ""));
    const rawOffers = parseJsonArray(String(formData.get("offers") ?? "[]"));
    const prizes = parseJsonArray(String(formData.get("prizes") ?? "[]"));
    const question = parseLegalQuestion(String(formData.get("question") ?? ""));

    const offers = raffle_subtype === "fifty_fifty" ? [] : rawOffers;

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
      draw_at,
      image_position,
      image_focus_x,
      image_focus_y,
      currency: currency as "GBP" | "USD" | "EUR",
      ticket_price,
      total_tickets,
      sold_tickets: 0,
      status: status as "draft" | "published" | "closed" | "drawn",
      raffle_subtype,
      startNumber,
      endNumber,
      numbersPerColour,
      colourCount: colours.length,
      colours,
      offers,
      prizes,
      sold: [],
      reserved: [],
      ...(question ? { question } : {}),
    } as any);

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
