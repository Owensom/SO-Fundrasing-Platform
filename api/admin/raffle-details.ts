function setJson(res: any, status: number, body: unknown) {
  res.statusCode = status;
  if (typeof res.setHeader === "function") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }
  res.end(JSON.stringify(body));
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getQueryValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function parseJsonArrayField(value: any) {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

async function getDb() {
  const mod: any = await import("../_lib/db.js");

  if (typeof mod.getDb === "function") return mod.getDb();
  if (typeof mod.default?.getDb === "function") return mod.default.getDb();
  if (mod.db && typeof mod.db.query === "function") return mod.db;
  if (mod.default && typeof mod.default.query === "function") return mod.default;

  if (typeof mod.query === "function") {
    return { query: mod.query.bind(mod) };
  }

  if (typeof mod.default?.query === "function") {
    return { query: mod.default.query.bind(mod.default) };
  }

  if (typeof mod.default === "function") {
    const instance = await mod.default();
    if (instance && typeof instance.query === "function") return instance;
  }

  if (mod.sql && typeof mod.sql === "function") {
    return {
      async query(text: string, params: any[] = []) {
        return mod.sql(text, params);
      },
    };
  }

  if (mod.default?.sql && typeof mod.default.sql === "function") {
    return {
      async query(text: string, params: any[] = []) {
        return mod.default.sql(text, params);
      },
    };
  }

  throw new Error("Unsupported db export shape");
}

async function getTenantBySlug(db: any, tenantSlug: string) {
  const result = await db.query(
    `
    select id, slug
    from tenants
    where slug = $1
    limit 1
    `,
    [tenantSlug]
  );

  return result.rows[0] ?? null;
}

function mapRow(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    type: row.type,
    slug: row.slug,
    title: row.title,
    description: row.description,
    heroImageUrl: row.hero_image_url,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    raffleConfig: {
      campaignId: row.id,
      singleTicketPriceCents: row.single_ticket_price_cents,
      totalTickets: row.total_tickets,
      soldTickets: row.sold_tickets,
      backgroundImageUrl: row.background_image_url,
      currencyCode: row.currency_code,
      colourSelectionMode: row.colour_selection_mode,
      numberSelectionMode: row.number_selection_mode,
      numberRangeStart: row.number_range_start,
      numberRangeEnd: row.number_range_end,
      colours: parseJsonArrayField(row.colours),
      createdAt: row.raffle_created_at,
      updatedAt: row.raffle_updated_at,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function handler(req: any, res: any) {
  if (String(req.method || "").toUpperCase() !== "GET") {
    return setJson(res, 405, {
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    const id = asTrimmedString(getQueryValue(req.query?.id));
    const tenantSlug =
      asTrimmedString(getQueryValue(req.query?.tenantSlug) ?? "demo-a") || "demo-a";

    if (!id) {
      return setJson(res, 400, {
        ok: false,
        error: "Missing raffle id",
      });
    }

    const db = await getDb();
    const tenant = await getTenantBySlug(db, tenantSlug);

    if (!tenant) {
      return setJson(res, 404, {
        ok: false,
        error: `Tenant not found for slug "${tenantSlug}"`,
      });
    }

    const result = await db.query(
      `
      select
        c.id,
        c.tenant_id,
        c.type,
        c.slug,
        c.title,
        c.description,
        c.hero_image_url,
        c.status,
        c.starts_at,
        c.ends_at,
        c.created_at,
        c.updated_at,
        rc.single_ticket_price_cents,
        rc.total_tickets,
        rc.sold_tickets,
        rc.background_image_url,
        rc.currency_code,
        rc.colour_selection_mode,
        rc.number_selection_mode,
        rc.number_range_start,
        rc.number_range_end,
        rc.colours,
        rc.created_at as raffle_created_at,
        rc.updated_at as raffle_updated_at
      from campaigns c
      left join raffle_configs rc
        on rc.campaign_id = c.id
      where c.id = $1
        and c.tenant_id = $2
        and c.type = 'raffle'
      limit 1
      `,
      [id, tenant.id]
    );

    if (!result.rows[0]) {
      return setJson(res, 404, {
        ok: false,
        error: "Raffle not found",
      });
    }

    return setJson(res, 200, {
      ok: true,
      raffle: mapRow(result.rows[0]),
    });
  } catch (error: any) {
    console.error("GET /api/admin/raffle-details error", error);
    return setJson(res, 500, {
      ok: false,
      error: error?.message || "Failed to load raffle",
      detail: error?.detail || null,
      code: error?.code || null,
    });
  }
}
