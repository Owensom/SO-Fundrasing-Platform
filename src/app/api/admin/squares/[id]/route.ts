import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import { query, queryOne } from "@/lib/db";
import { getTenantSettings } from "@/lib/tenant-settings";
import { canPublishAnotherCampaign } from "@/lib/subscription-capabilities";
import {
  getSquaresGameById,
  normalisePrizes,
  slugify,
} from "../../../../../../api/_lib/squares-repo";

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

function normaliseFocus(
  value: FormDataEntryValue | string | null | undefined,
  fallback = 50,
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.max(0, Math.min(100, Math.round(parsed)));
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

function parseDateTime(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function parseBritishDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (!raw) return null;

  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) {
    return null;
  }

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

  return {
    day,
    month,
    year,
  };
}

function parseTime(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (!raw) return null;

  const match = raw.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return null;
  }

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

  return {
    hour,
    minute,
  };
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
    session,
    tenantSlug,
  };
}

async function canTenantPublishCampaign(tenantSlug: string) {
  const activeCampaignCounts = await queryOne<{
    total: number;
  }>(
    `
      select count(*)::int as total
      from (
        select 1
        from raffles
        where tenant_slug = $1
          and status = 'published'

        union all

        select 1
        from squares_games
        where tenant_slug = $1
          and status = 'published'

        union all

        select 1
        from events
        where tenant_slug = $1
          and status = 'published'
      ) active_campaigns
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

export async function GET(request: NextRequest, context: RouteContext) {
  const access = await requireTenantAccess(request);

  if (!access.ok) {
    return access.response;
  }

  const { tenantSlug } = access;
  const id = context.params.id;

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
        { ok: false, error: "Squares game not found" },
        { status: 404 },
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
  const access = await requireTenantAccess(request);

  if (!access.ok) {
    return access.response;
  }

  const { tenantSlug } = access;
  const id = context.params.id;

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
        { ok: false, error: "Squares game not found" },
        { status: 404 },
      );
    }

    const formData = await request.formData();

    const title = String(formData.get("title") ?? existing.title).trim();
    const rawSlug = String(formData.get("slug") ?? existing.slug).trim();
    const cleanSlug = slugify(rawSlug || existing.slug);

    const description = String(formData.get("description") ?? "").trim();

    const imageUrl = String(
      formData.get("image_url") ?? existing.image_url ?? "",
    ).trim();

    const currentConfig = (existing.config_json ?? {}) as any;

    const imageFocusX = normaliseFocus(
      formData.get("image_focus_x"),
      normaliseFocus(currentConfig.image_focus_x, 50),
    );

    const imageFocusY = normaliseFocus(
      formData.get("image_focus_y"),
      normaliseFocus(currentConfig.image_focus_y, 50),
    );

    const currency = String(
      formData.get("currency") ?? existing.currency ?? "GBP",
    );

    const status = String(formData.get("status") ?? existing.status);

    if (status === "published" && existing.status !== "published") {
      const allowedToPublish = await canTenantPublishCampaign(tenantSlug);

      if (!allowedToPublish) {
        return NextResponse.redirect(
          new URL(`/admin/squares/${id}?error=campaign_limit`, request.url),
          { status: 303 },
        );
      }
    }

    const totalSquares = Math.min(
      500,
      Math.max(
        1,
        parseNumber(formData.get("total_squares"), existing.total_squares),
      ),
    );

    const priceMajor = parseNumber(
      formData.get("price_per_square"),
      existing.price_per_square_cents / 100,
    );

    const pricePerSquareCents = Math.round(priceMajor * 100);

    const splitDrawAt = parseSplitDateTime(
      formData.get("draw_date"),
      formData.get("draw_time"),
    );

    if (!splitDrawAt.ok) {
      return NextResponse.redirect(
        new URL(`/admin/squares/${id}?error=invalid_draw_datetime`, request.url),
        { status: 303 },
      );
    }

    const drawAt =
      formData.has("draw_date") || formData.has("draw_time")
        ? splitDrawAt.value
        : parseDateTime(formData.get("draw_at"));

    const prizes = parsePrizeRows(formData);

    const autoDrawFromPrize = Math.max(
      1,
      Math.floor(parseNumber(formData.get("auto_draw_from_prize"), 1)),
    );

    const autoDrawToPrize = Math.max(
      autoDrawFromPrize,
      Math.floor(parseNumber(formData.get("auto_draw_to_prize"), 999)),
    );

    const questionText = String(formData.get("question_text") ?? "").trim();
    const questionAnswer = String(formData.get("question_answer") ?? "").trim();

    const freeEntryAddress = String(
      formData.get("free_entry_address") ?? "",
    ).trim();

    const freeEntryInstructions = String(
      formData.get("free_entry_instructions") ?? "",
    ).trim();

    const splitFreeEntryClosesAt = parseSplitDateTime(
      formData.get("free_entry_closes_date"),
      formData.get("free_entry_closes_time"),
    );

    if (!splitFreeEntryClosesAt.ok) {
      return NextResponse.redirect(
        new URL(
          `/admin/squares/${id}?error=invalid_postal_datetime`,
          request.url,
        ),
        { status: 303 },
      );
    }

    const freeEntryClosesAt =
      formData.has("free_entry_closes_date") ||
      formData.has("free_entry_closes_time")
        ? splitFreeEntryClosesAt.value
        : parseDateTime(formData.get("free_entry_closes_at"));

    const config = {
      ...currentConfig,
      prizes,
      sold: Array.isArray(currentConfig.sold) ? currentConfig.sold : [],
      reserved: Array.isArray(currentConfig.reserved)
        ? currentConfig.reserved
        : [],
      image_focus_x: imageFocusX,
      image_focus_y: imageFocusY,
      auto_draw_from_prize: autoDrawFromPrize,
      auto_draw_to_prize: autoDrawToPrize,
      question:
        questionText || questionAnswer
          ? {
              text: questionText,
              answer: questionAnswer,
            }
          : null,
      free_entry:
        freeEntryAddress || freeEntryInstructions || freeEntryClosesAt
          ? {
              address: freeEntryAddress,
              instructions: freeEntryInstructions,
              closes_at: freeEntryClosesAt,
            }
          : null,
    };

    await query(
      `
        update squares_games
        set
          slug = $2,
          title = $3,
          description = $4,
          image_url = $5,
          draw_at = $6,
          status = $7,
          currency = $8,
          price_per_square_cents = $9,
          total_squares = $10,
          config_json = $11::jsonb,
          updated_at = now()
        where id = $1
          and tenant_slug = $12
      `,
      [
        existing.id,
        cleanSlug || existing.slug,
        title || existing.title,
        description,
        imageUrl,
        drawAt,
        status,
        currency,
        pricePerSquareCents,
        totalSquares,
        JSON.stringify(config),
        tenantSlug,
      ],
    );

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
