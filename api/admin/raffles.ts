type ColourOption = {
  name: string;
  hex: string;
};

type OfferOption = {
  label: string;
  price: number;
  entries: number;
};

type JsonRecord = Record<string, unknown>;

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

function setJson(res: any, status: number, body: unknown) {
  res.statusCode = status;
  if (typeof res.setHeader === "function") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }
  res.end(JSON.stringify(body));
}

function setAllowed(res: any, allowed: string[]) {
  if (typeof res.setHeader === "function") {
    res.setHeader("Allow", allowed.join(", "));
  }
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalString(value: unknown): string | null {
  const s = asTrimmedString(value);
  return s ? s : null;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseId(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function getQueryValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function normaliseColours(input: unknown): ColourOption[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      const raw = (item ?? {}) as JsonRecord;
      const name = asTrimmedString(raw.name);
      const hex = asTrimmedString(raw.hex);

      if (!name || !HEX_RE.test(hex)) {
        return null;
      }

      return {
        name,
        hex: hex.toUpperCase(),
      };
    })
    .filter(Boolean) as ColourOption[];
}

function normaliseOffers(input: unknown): OfferOption[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      const raw = (item ?? {}) as JsonRecord;
      const label = asTrimmedString(raw.label);
      const price = asNumber(raw.price);
      const entries = asNumber(raw.entries);

      if (!label) return null;
      if (!(price > 0)) return null;
      if (!Number.isInteger(entries) || entries <= 0) return null;

      return {
        label,
        price,
        entries,
      };
    })
    .filter(Boolean) as OfferOption[];
}

async function readBody(req: any): Promise<any> {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const chunks: Uint8Array[] = [];

  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    req.on("end", () => resolve());
    req.on("error", (err: unknown) => reject(err));
  });

  if (chunks.length === 0) return {};

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function getDb() {
  const mod: any = await import("../_lib/db.js");

  if (typeof mod.getDb === "function") {
    return mod.getDb();
  }

  if (typeof mod.default?.getDb === "function") {
    return mod.default.getDb();
  }

  if (mod.db && typeof mod.db.query === "function") {
    return mod.db;
  }

  if (mod.default && typeof mod.default.query === "function") {
    return mod.default;
  }

  if (typeof mod.query === "function") {
    return {
      query: mod.query.bind(mod),
    };
  }

  if (typeof mod.default?.query === "function") {
    return {
      query: mod.default.query.bind(mod.default),
    };
  }

  if (typeof mod.default === "function") {
    const instance = await mod.default();
    if (instance && typeof instance.query === "function") {
      return instance;
    }
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

  throw new Error(
    "Unsupported ../_lib/db.ts export shape. Expected getDb(), db.query(...), query(...), or sql(...)."
  );
}

async function getTenantBySlug(db: any, tenantSlug: string) {
  const result = await db.query(
    `
    select id, slug, name
    from tenants
    where slug = $1
    limit 1
    `,
    [tenantSlug]
  );

  return result.rows[0] ?? null;
}

async function resolveCampaignIdForTenant(
  db: any,
  tenantId: number,
  campaignIdInput?: unknown
): Promise<number | null> {
  const explicitCampaignId = parseId(campaignIdInput);

  if (explicitCampaignId) {
    const explicit = await db.query(
      `
      select id
      from campaigns
      where id = $1 and tenant_id = $2
      limit 1
      `,
      [explicitCampaignId, tenantId]
    );

    if (explicit.rows[0]?.id) {
      return explicit.rows[0].id;
    }
  }

  const fallback = await db.query(
    `
    select id
    from campaigns
    where tenant_id = $1
    order by id asc
    limit 1
    `,
    [tenantId]
  );

  return fallback.rows[0]?.id ?? null;
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

function mapRaffleRow(row: any) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    campaignTitle: row.campaign_title ?? null,
    title: row.title,
    description: row.description,
    status: row.status,
    sortOrder: row.sort_order,
    colours: parseJsonArrayField(row.colours),
    offers: parseJsonArrayField(row.offers),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listRaffles(req: any, res: any) {
  try {
    const tenantSlug =
      asTrimmedString(getQueryValue(req.query?.tenantSlug) ?? "demo-a") || "demo-a";

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
        rc.id,
        rc.campaign_id,
        rc.title,
        rc.description,
        rc.status,
        rc.sort_order,
        rc.colours,
        rc.offers,
        rc.created_at,
        rc.updated_at,
        c.title as campaign_title
      from raffle_configs rc
      inner join campaigns c on c.id = rc.campaign_id
      where c.tenant_id = $1
      order by
        coalesce(rc.sort_order, 999999) asc,
        rc.created_at desc,
        rc.id desc
      `,
      [tenant.id]
    );

    return setJson(res, 200, {
      ok: true,
      raffles: result.rows.map(mapRaffleRow),
    });
  } catch (error: any) {
    console.error("GET /api/admin/raffles error", error);
    return setJson(res, 500, {
      ok: false,
      error: error?.message || "Failed to load raffles",
      detail: error?.detail || null,
      code: error?.code || null,
    });
  }
}

async function createRaffle(req: any, res: any) {
  try {
    const body = await readBody(req);

    const tenantSlug = asTrimmedString(body.tenantSlug || "demo-a") || "demo-a";
    const title = asTrimmedString(body.title);
    const description = asOptionalString(body.description);
    const status = asTrimmedString(body.status) || "active";
    const sortOrder = asNumber(body.sortOrder, 0);
    const colours = normaliseColours(body.colours);
    const offers = normaliseOffers(body.offers);

    if (!title) {
      return setJson(res, 400, {
        ok: false,
        error: "Title is required",
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

    const campaignId = await resolveCampaignIdForTenant(
      db,
      tenant.id,
      body.campaignId
    );

    if (!campaignId) {
      return setJson(res, 400, {
        ok: false,
        error: `No campaign found for tenant "${tenantSlug}". Create a campaign row first or pass a valid campaignId.`,
      });
    }

    const result = await db.query(
      `
      insert into raffle_configs (
        campaign_id,
        title,
        description,
        status,
        sort_order,
        colours,
        offers,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, now(), now())
      returning
        id,
        campaign_id,
        title,
        description,
        status,
        sort_order,
        colours,
        offers,
        created_at,
        updated_at
      `,
      [
        campaignId,
        title,
        description,
        status,
        sortOrder,
        JSON.stringify(colours),
        JSON.stringify(offers),
      ]
    );

    return setJson(res, 201, {
      ok: true,
      raffle: mapRaffleRow(result.rows[0]),
    });
  } catch (error: any) {
    console.error("POST /api/admin/raffles error", error);
    return setJson(res, 500, {
      ok: false,
      error: error?.message || "Failed to create raffle",
      detail: error?.detail || null,
      code: error?.code || null,
    });
  }
}

async function updateRaffle(req: any, res: any) {
  try {
    const body = await readBody(req);

    const id = parseId(body.id);
    const tenantSlug = asTrimmedString(body.tenantSlug || "demo-a") || "demo-a";

    if (!id) {
      return setJson(res, 400, {
        ok: false,
        error: "Valid raffle id is required",
      });
    }

    const title = asTrimmedString(body.title);
    const description = asOptionalString(body.description);
    const status = asTrimmedString(body.status) || "active";
    const sortOrder = asNumber(body.sortOrder, 0);
    const colours = normaliseColours(body.colours);
    const offers = normaliseOffers(body.offers);

    if (!title) {
      return setJson(res, 400, {
        ok: false,
        error: "Title is required",
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

    const existingResult = await db.query(
      `
      select
        rc.id,
        rc.campaign_id
      from raffle_configs rc
      inner join campaigns c on c.id = rc.campaign_id
      where rc.id = $1
        and c.tenant_id = $2
      limit 1
      `,
      [id, tenant.id]
    );

    const existing = existingResult.rows[0];

    if (!existing) {
      return setJson(res, 404, {
        ok: false,
        error: "Raffle not found",
      });
    }

    const resolvedCampaignId =
      (await resolveCampaignIdForTenant(db, tenant.id, body.campaignId)) ||
      existing.campaign_id;

    const result = await db.query(
      `
      update raffle_configs
      set
        campaign_id = $2,
        title = $3,
        description = $4,
        status = $5,
        sort_order = $6,
        colours = $7::jsonb,
        offers = $8::jsonb,
        updated_at = now()
      where id = $1
      returning
        id,
        campaign_id,
        title,
        description,
        status,
        sort_order,
        colours,
        offers,
        created_at,
        updated_at
      `,
      [
        id,
        resolvedCampaignId,
        title,
        description,
        status,
        sortOrder,
        JSON.stringify(colours),
        JSON.stringify(offers),
      ]
    );

    return setJson(res, 200, {
      ok: true,
      raffle: mapRaffleRow(result.rows[0]),
    });
  } catch (error: any) {
    console.error("PUT /api/admin/raffles error", error);
    return setJson(res, 500, {
      ok: false,
      error: error?.message || "Failed to update raffle",
      detail: error?.detail || null,
      code: error?.code || null,
    });
  }
}

async function deleteRaffle(req: any, res: any) {
  try {
    const body = await readBody(req);

    const id = parseId(body.id ?? getQueryValue(req.query?.id));
    const tenantSlug =
      asTrimmedString(
        body.tenantSlug ?? getQueryValue(req.query?.tenantSlug) ?? "demo-a"
      ) || "demo-a";

    if (!id) {
      return setJson(res, 400, {
        ok: false,
        error: "Valid raffle id is required",
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

    const existingResult = await db.query(
      `
      select
        rc.id
      from raffle_configs rc
      inner join campaigns c on c.id = rc.campaign_id
      where rc.id = $1
        and c.tenant_id = $2
      limit 1
      `,
      [id, tenant.id]
    );

    if (!existingResult.rows[0]) {
      return setJson(res, 404, {
        ok: false,
        error: "Raffle not found",
      });
    }

    const result = await db.query(
      `
      delete from raffle_configs
      where id = $1
      returning id
      `,
      [id]
    );

    if (!result.rows[0]) {
      return setJson(res, 404, {
        ok: false,
        error: "Raffle not found",
      });
    }

    return setJson(res, 200, {
      ok: true,
      deletedId: id,
    });
  } catch (error: any) {
    console.error("DELETE /api/admin/raffles error", error);
    return setJson(res, 500, {
      ok: false,
      error: error?.message || "Failed to delete raffle",
      detail: error?.detail || null,
      code: error?.code || null,
    });
  }
}

export default async function handler(req: any, res: any) {
  const method = String(req.method || "").toUpperCase();

  if (method === "GET") return listRaffles(req, res);
  if (method === "POST") return createRaffle(req, res);
  if (method === "PUT") return updateRaffle(req, res);
  if (method === "DELETE") return deleteRaffle(req, res);

  setAllowed(res, ["GET", "POST", "PUT", "DELETE"]);
  return setJson(res, 405, {
    ok: false,
    error: "Method not allowed",
  });
}
