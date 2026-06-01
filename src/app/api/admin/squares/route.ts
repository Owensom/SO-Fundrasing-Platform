import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import { queryOne } from "@/lib/db";
import { getTenantSettings } from "@/lib/tenant-settings";
import { canPublishAnotherCampaign } from "@/lib/subscription-capabilities";
import {
  createSquaresGame,
  listSquaresGames,
  normaliseFreeEntry,
  normaliseLegalQuestion,
  normalisePrizes,
  slugify,
} from "../../../../../api/_lib/squares-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseNumber(
  value: FormDataEntryValue | string | null | undefined,
  fallback = 0,
) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseJsonValue(value: string) {
  if (!value.trim()) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parsePrizesJson(value: string) {
  const parsed = parseJsonValue(value);

  if (!parsed) return [];

  return normalisePrizes(parsed);
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

function parseQuestion(formData: FormData) {
  return normaliseLegalQuestion(
    parseJsonValue(String(formData.get("question") ?? "")),
  );
}

function parseFreeEntry(formData: FormData) {
  return normaliseFreeEntry(
    parseJsonValue(String(formData.get("free_entry") ?? "")),
  );
}

function parseDateTime(value: FormDataEntryValue | null) {
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

function parseBritishDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (!raw) return null;

  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12 ||
    year < 2000 ||
    year > 2100
  ) {
    return null;
  }

  return { day, month, year };
}

function parseTime(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (!raw) return null;

  const match = raw.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return { hour, minute };
}

function parseSplitDateTime(
  dateValue: FormDataEntryValue | null,
  timeValue: FormDataEntryValue | null,
) {
  const rawDate = String(dateValue ?? "").trim();
  const rawTime = String(timeValue ?? "").trim();

  if (!rawDate && !rawTime) {
    return {
      ok: true as const,
      value: null as string | null,
    };
  }

  const date = parseBritishDate(dateValue);
  const time = parseTime(timeValue);

  if (!date || !time) {
    return {
      ok: false as const,
      value: null,
    };
  }

  const parsed = new Date(
    Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, 0),
  );

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== date.year ||
    parsed.getUTCMonth() !== date.month - 1 ||
    parsed.getUTCDate() !== date.day ||
    parsed.getUTCHours() !== time.hour ||
    parsed.getUTCMinutes() !== time.minute
  ) {
    return {
      ok: false as const,
      value: null,
    };
  }

  return {
    ok: true as const,
    value: parsed.toISOString(),
  };
}

function normaliseTierForCampaignLimit(value: unknown) {
  const tier = String(value || "").trim().toLowerCase();

  if (tier === "foundation") return "foundation";
  if (tier === "professional") return "professional";
  return "community";
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

  if (tenantSettings?.platform_owner_bypass) {
    return true;
  }

  return canPublishAnotherCampaign({
    subscription_tier: normaliseTierForCampaignLimit(
      tenantSettings?.subscription_tier,
    ),
    currentActiveCampaigns,
  });
}

export async function GET(request: NextRequest) {
  const access = await requireTenantAccess(request);

  if (!access.ok) {
    return access.response;
  }

  try {
    const items = await listSquaresGames(access.tenantSlug);

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
  const access = await requireTenantAccess(request);

  if (!access.ok) {
    return access.response;
  }

  const tenantSlug = access.tenantSlug;

  try {
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

    const splitDrawAt = parseSplitDateTime(
      formData.get("draw_date"),
      formData.get("draw_time"),
    );

    if (!splitDrawAt.ok) {
      return NextResponse.redirect(
        new URL("/admin/squares/new?error=invalid_draw_datetime", request.url),
        { status: 303 },
      );
    }

    const draw_at =
      formData.has("draw_date") || formData.has("draw_time")
        ? splitDrawAt.value
        : parseDateTime(formData.get("draw_at"));

    const currency = String(formData.get("currency") ?? "GBP") as
      | "GBP"
      | "USD"
      | "EUR";

    const status = String(formData.get("status") ?? "draft") as
      | "draft"
      | "published"
      | "closed"
      | "drawn";

    if (status === "published") {
      const allowedToPublish = await canTenantPublishCampaign(tenantSlug);

      if (!allowedToPublish) {
        return NextResponse.redirect(
          new URL("/admin/squares/new?error=campaign_limit", request.url),
          { status: 303 },
        );
      }
    }

    const total_squares = Math.min(
      500,
      Math.max(1, parseNumber(formData.get("total_squares"), 100)),
    );

    const priceMajor = parseNumber(formData.get("price_per_square"), 0);
    const price_per_square_cents = Math.max(0, Math.round(priceMajor * 100));

    const prizes = parsePrizes(formData);
    const question = parseQuestion(formData);
    const free_entry = parseFreeEntry(formData);

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
      question,
      free_entry,
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
