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
type SchemaMap = Record<string, string | null>;

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

function qi(identifier: string | null | undefined) {
  if (!identifier) {
    throw new Error("Missing SQL identifier");
  }
  return `"${identifier.replace(/"/g, `""`)}"`;
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

  throw new Error(
    "Unsupported ../_lib/db.ts export shape. Expected getDb(), db.query(...), query(...), or sql(...)."
  );
}

async function getColumns(db: any, tableName: string): Promise<string[]> {
  const result = await db.query(
    `
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = $1
    order by ordinal_position
    `,
    [tableName]
  );

  return result.rows.map((r: any) => String(r.column_name));
}

function pick(columns: string[], candidates: string[]) {
  for (const c of candidates) {
    if (columns.includes(c)) return c;
  }
  return null;
}

async function getSchema(db: any) {
  const raffleCols = await getColumns(db, "raffle_configs");
  const campaignCols = await getColumns(db, "campaigns");
  const tenantCols = await getColumns(db, "tenants");

  const raffle: SchemaMap = {
    id: pick(raffleCols, ["id", "raffle_config_id", "config_id"]),
    campaignId: pick(raffleCols, ["campaign_id", "campaign", "campaign_ref"]),
    title: pick(raffleCols, ["title", "name", "raffle_title", "config_title"]),
    description: pick(raffleCols, ["description", "details", "summary"]),
    status: pick(raffleCols, ["status"]),
    isActive: pick(raffleCols, ["is_active", "active", "enabled"]),
    sortOrder: pick(raffleCols, ["sort_order", "position", "display_order", "sort"]),
    colours: pick(raffleCols, ["colours", "colors", "colour_options", "color_options"]),
    offers: pick(raffleCols, ["offers", "offer_options", "packages"]),
    createdAt: pick(raffleCols, ["created_at", "createdon", "created"]),
    updatedAt: pick(raffleCols, ["updated_at", "updatedon", "updated"]),
  };

  const campaigns: SchemaMap = {
    id: pick(campaignCols, ["id", "campaign_id"]),
    tenantId: pick(campaignCols, ["tenant_id", "tenant", "tenant_ref"]),
    title: pick(campaignCols, ["title", "name", "campaign_title"]),
  };

  const tenants: SchemaMap = {
    id: pick(tenantCols, ["id", "tenant_id"]),
    slug: pick(tenantCols, ["slug", "tenant_slug"]),
    name: pick(tenantCols, ["name", "tenant_name", "title"]),
  };

  return { raffleCols, campaignCols, tenantCols, raffle, campaigns, tenants };
}

async function getTenantBySlug(db: any, tenantSlug: string, schema: any) {
  if (!schema.tenants.id || !schema.tenants.slug) {
    throw new Error("Could not resolve tenants.id / tenants.slug columns");
  }

  const result = await db.query(
    `
    select
      ${qi(schema.tenants.id)} as id,
      ${qi(schema.tenants.slug)} as slug
      ${schema.tenants.name ? `, ${qi(schema.tenants.name)} as name` : ""}
    from tenants
    where ${qi(schema.tenants.slug)} = $1
    limit 1
    `,
    [tenantSlug]
  );

  return result.rows[0] ?? null;
}

async function resolveCampaignIdForTenant(
  db: any,
  tenantId: number,
  schema: any,
  campaignIdInput?: unknown
): Promise<number | null> {
  if (!schema.campaigns.id || !schema.campaigns.tenantId) {
    throw new Error("Could not resolve campaigns.id / campaigns.tenant_id columns");
  }

  const explicitCampaignId = parseId(campaignIdInput);

  if (explicitCampaignId) {
    const explicit = await db.query(
      `
      select ${qi(schema.campaigns.id)} as id
      from campaigns
      where ${qi(schema.campaigns.id)} = $1
        and ${qi(schema.campaigns.tenantId)} = $2
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
    select ${qi(schema.campaigns.id)} as id
    from campaigns
    where ${qi(schema.campaigns.tenantId)} = $1
    order by ${qi(schema.campaigns.id)} asc
    limit 1
    `,
    [tenantId]
  );

  return fallback.rows[0]?.id ?? null;
}

function mapRaffleRow(row: any) {
  const rawStatus =
    row.status != null
      ? row.status
      : row.is_active != null
      ? row.is_active
        ? "active"
        : "inactive"
      : null;

  return {
    id: row.id,
    campaignId: row.campaign_id,
    campaignTitle: row.campaign_title ?? null,
    title: row.title ?? "",
    description: row.description ?? null,
    status: rawStatus,
    sortOrder: row.sort_order ?? 0,
    colours: parseJsonArrayField(row.colours),
    offers: parseJsonArrayField(row.offers),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

async function listRaffles(req: any, res: any) {
  try {
    const tenantSlug =
      asTrimmedString(getQueryValue(req.query?.tenantSlug) ?? "demo-a") || "demo-a";

    const db = await getDb();
    const schema = await getSchema(db);

    if (!schema.raffle.id || !schema.raffle.campaignId) {
      return setJson(res, 500, {
        ok: false,
        error: "Could not resolve raffle_configs primary key / campaign reference columns",
        schema,
      });
    }

    if (!schema.campaigns.id || !schema.campaigns.tenantId) {
      return setJson(res, 500, {
        ok: false,
        error: "Could not resolve campaigns id / tenant columns",
        schema,
      });
    }

    const tenant = await getTenantBySlug(db, tenantSlug, schema);

    if (!tenant) {
      return setJson(res, 404, {
        ok: false,
        error: `Tenant not found for slug "${tenantSlug}"`,
      });
    }

    const selectTitle = schema.raffle.title
      ? `rc.${qi(schema.raffle.title)} as title`
      : `null as title`;

    const selectDescription = schema.raffle.description
      ? `rc.${qi(schema.raffle.description)} as description`
      : `null as description`;

    const selectStatus = schema.raffle.status
      ? `rc.${qi(schema.raffle.status)} as status`
      : `null as status`;

    const selectIsActive = schema.raffle.isActive
      ? `rc.${qi(schema.raffle.isActive)} as is_active`
      : `null as is_active`;

    const selectSortOrder = schema.raffle.sortOrder
      ? `rc.${qi(schema.raffle.sortOrder)} as sort_order`
      : `null as sort_order`;

    const selectColours = schema.raffle.colours
      ? `rc.${qi(schema.raffle.colours)} as colours`
      : `'[]' as colours`;

    const selectOffers = schema.raffle.offers
      ? `rc.${qi(schema.raffle.offers)} as offers`
      : `'[]' as offers`;

    const selectCreatedAt = schema.raffle.createdAt
      ? `rc.${qi(schema.raffle.createdAt)} as created_at`
      : `null as created_at`;

    const selectUpdatedAt = schema.raffle.updatedAt
      ? `rc.${qi(schema.raffle.updatedAt)} as updated_at`
      : `null as updated_at`;

    const selectCampaignTitle = schema.campaigns.title
      ? `c.${qi(schema.campaigns.title)} as campaign_title`
      : `null as campaign_title`;

    const orderBy = schema.raffle.sortOrder
      ? `coalesce(rc.${qi(schema.raffle.sortOrder)}, 999999) asc`
      : `rc.${qi(schema.raffle.id)} desc`;

    const result = await db.query(
      `
      select
        rc.${qi(schema.raffle.id)} as id,
        rc.${qi(schema.raffle.campaignId)} as campaign_id,
        ${selectTitle},
        ${selectDescription},
        ${selectStatus},
        ${selectIsActive},
        ${selectSortOrder},
        ${selectColours},
        ${selectOffers},
        ${selectCreatedAt},
        ${selectUpdatedAt},
        ${selectCampaignTitle}
      from raffle_configs rc
      inner join campaigns c
        on c.${qi(schema.campaigns.id)} = rc.${qi(schema.raffle.campaignId)}
      where c.${qi(schema.campaigns.tenantId)} = $1
      order by ${orderBy}
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

    const db = await getDb();
    const schema = await getSchema(db);

    if (!schema.raffle.campaignId) {
      return setJson(res, 500, {
        ok: false,
        error: "Could not resolve raffle_configs campaign reference column",
        schema,
      });
    }

    if (!schema.raffle.title) {
      return setJson(res, 500, {
        ok: false,
        error: "Could not resolve raffle_configs title/name column",
        schema,
      });
    }

    if (!title) {
      return setJson(res, 400, {
        ok: false,
        error: "Title is required",
      });
    }

    const tenant = await getTenantBySlug(db, tenantSlug, schema);

    if (!tenant) {
      return setJson(res, 404, {
        ok: false,
        error: `Tenant not found for slug "${tenantSlug}"`,
      });
    }

    const campaignId = await resolveCampaignIdForTenant(
      db,
      tenant.id,
      schema,
      body.campaignId
    );

    if (!campaignId) {
      return setJson(res, 400, {
        ok: false,
        error: `No campaign found for tenant "${tenantSlug}". Create a campaign row first or pass a valid campaignId.`,
      });
    }

    const columns: string[] = [];
    const values: any[] = [];

    columns.push(qi(schema.raffle.campaignId));
    values.push(campaignId);

    columns.push(qi(schema.raffle.title));
    values.push(title);

    if (schema.raffle.description) {
      columns.push(qi(schema.raffle.description));
      values.push(description);
    }

    if (schema.raffle.status) {
      columns.push(qi(schema.raffle.status));
      values.push(status);
    } else if (schema.raffle.isActive) {
      columns.push(qi(schema.raffle.isActive));
      values.push(status === "active");
    }

    if (schema.raffle.sortOrder) {
      columns.push(qi(schema.raffle.sortOrder));
      values.push(sortOrder);
    }

    if (schema.raffle.colours) {
      columns.push(qi(schema.raffle.colours));
      values.push(JSON.stringify(colours));
    }

    if (schema.raffle.offers) {
      columns.push(qi(schema.raffle.offers));
      values.push(JSON.stringify(offers));
    }

    if (schema.raffle.createdAt) {
      columns.push(qi(schema.raffle.createdAt));
    }

    if (schema.raffle.updatedAt) {
      columns.push(qi(schema.raffle.updatedAt));
    }

    const placeholders = columns.map((col, idx) => {
      const unquoted = col.replace(/"/g, "");
      if (schema.raffle.createdAt && unquoted === schema.raffle.createdAt) {
        return "now()";
      }
      if (schema.raffle.updatedAt && unquoted === schema.raffle.updatedAt) {
        return "now()";
      }

      let valueIndex = 0;
      for (let i = 0; i <= idx; i++) {
        const current = columns[i].replace(/"/g, "");
        if (
          (schema.raffle.createdAt && current === schema.raffle.createdAt) ||
          (schema.raffle.updatedAt && current === schema.raffle.updatedAt)
        ) {
          continue;
        }
        valueIndex++;
      }
      return `$${valueIndex}`;
    });

    const returningId = schema.raffle.id
      ? `${qi(schema.raffle.id)} as id`
      : `null as id`;

    const returningCampaignId = `${qi(schema.raffle.campaignId)} as campaign_id`;
    const returningTitle = `${qi(schema.raffle.title)} as title`;
    const returningDescription = schema.raffle.description
      ? `${qi(schema.raffle.description)} as description`
      : `null as description`;
    const returningStatus = schema.raffle.status
      ? `${qi(schema.raffle.status)} as status`
      : `null as status`;
    const returningIsActive = schema.raffle.isActive
      ? `${qi(schema.raffle.isActive)} as is_active`
      : `null as is_active`;
    const returningSortOrder = schema.raffle.sortOrder
      ? `${qi(schema.raffle.sortOrder)} as sort_order`
      : `null as sort_order`;
    const returningColours = schema.raffle.colours
      ? `${qi(schema.raffle.colours)} as colours`
      : `'[]' as colours`;
    const returningOffers = schema.raffle.offers
      ? `${qi(schema.raffle.offers)} as offers`
      : `'[]' as offers`;
    const returningCreatedAt = schema.raffle.createdAt
      ? `${qi(schema.raffle.createdAt)} as created_at`
      : `null as created_at`;
    const returningUpdatedAt = schema.raffle.updatedAt
      ? `${qi(schema.raffle.updatedAt)} as updated_at`
      : `null as updated_at`;

    const result = await db.query(
      `
      insert into raffle_configs (
        ${columns.join(", ")}
      )
      values (
        ${placeholders.join(", ")}
      )
      returning
        ${returningId},
        ${returningCampaignId},
        ${returningTitle},
        ${returningDescription},
        ${returningStatus},
        ${returningIsActive},
        ${returningSortOrder},
        ${returningColours},
        ${returningOffers},
        ${returningCreatedAt},
        ${returningUpdatedAt}
      `,
      values
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

    const db = await getDb();
    const schema = await getSchema(db);

    if (!schema.raffle.id || !schema.raffle.campaignId || !schema.raffle.title) {
      return setJson(res, 500, {
        ok: false,
        error: "Could not resolve raffle_configs id / campaign / title columns",
        schema,
      });
    }

    if (!schema.campaigns.id || !schema.campaigns.tenantId) {
      return setJson(res, 500, {
        ok: false,
        error: "Could not resolve campaigns id / tenant columns",
        schema,
      });
    }

    const tenant = await getTenantBySlug(db, tenantSlug, schema);

    if (!tenant) {
      return setJson(res, 404, {
        ok: false,
        error: `Tenant not found for slug "${tenantSlug}"`,
      });
    }

    const existingResult = await db.query(
      `
      select
        rc.${qi(schema.raffle.id)} as id,
        rc.${qi(schema.raffle.campaignId)} as campaign_id
      from raffle_configs rc
      inner join campaigns c
        on c.${qi(schema.campaigns.id)} = rc.${qi(schema.raffle.campaignId)}
      where rc.${qi(schema.raffle.id)} = $1
        and c.${qi(schema.campaigns.tenantId)} = $2
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
      (await resolveCampaignIdForTenant(db, tenant.id, schema, body.campaignId)) ||
      existing.campaign_id;

    const sets: string[] = [];
    const values: any[] = [];
    let i = 1;

    sets.push(`${qi(schema.raffle.campaignId)} = $${i++}`);
    values.push(resolvedCampaignId);

    sets.push(`${qi(schema.raffle.title)} = $${i++}`);
    values.push(title);

    if (schema.raffle.description) {
      sets.push(`${qi(schema.raffle.description)} = $${i++}`);
      values.push(description);
    }

    if (schema.raffle.status) {
      sets.push(`${qi(schema.raffle.status)} = $${i++}`);
      values.push(status);
    } else if (schema.raffle.isActive) {
      sets.push(`${qi(schema.raffle.isActive)} = $${i++}`);
      values.push(status === "active");
    }

    if (schema.raffle.sortOrder) {
      sets.push(`${qi(schema.raffle.sortOrder)} = $${i++}`);
      values.push(sortOrder);
    }

    if (schema.raffle.colours) {
      sets.push(`${qi(schema.raffle.colours)} = $${i++}`);
      values.push(JSON.stringify(colours));
    }

    if (schema.raffle.offers) {
      sets.push(`${qi(schema.raffle.offers)} = $${i++}`);
      values.push(JSON.stringify(offers));
    }

    if (schema.raffle.updatedAt) {
      sets.push(`${qi(schema.raffle.updatedAt)} = now()`);
    }

    values.push(id);

    const result = await db.query(
      `
      update raffle_configs
      set ${sets.join(", ")}
      where ${qi(schema.raffle.id)} = $${i}
      returning
        ${qi(schema.raffle.id)} as id,
        ${qi(schema.raffle.campaignId)} as campaign_id,
        ${qi(schema.raffle.title)} as title,
        ${
          schema.raffle.description
            ? `${qi(schema.raffle.description)} as description`
            : `null as description`
        },
        ${
          schema.raffle.status
            ? `${qi(schema.raffle.status)} as status`
            : `null as status`
        },
        ${
          schema.raffle.isActive
            ? `${qi(schema.raffle.isActive)} as is_active`
            : `null as is_active`
        },
        ${
          schema.raffle.sortOrder
            ? `${qi(schema.raffle.sortOrder)} as sort_order`
            : `null as sort_order`
        },
        ${
          schema.raffle.colours
            ? `${qi(schema.raffle.colours)} as colours`
            : `'[]' as colours`
        },
        ${
          schema.raffle.offers
            ? `${qi(schema.raffle.offers)} as offers`
            : `'[]' as offers`
        },
        ${
          schema.raffle.createdAt
            ? `${qi(schema.raffle.createdAt)} as created_at`
            : `null as created_at`
        },
        ${
          schema.raffle.updatedAt
            ? `${qi(schema.raffle.updatedAt)} as updated_at`
            : `null as updated_at`
        }
      `,
      values
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
    const schema = await getSchema(db);

    if (!schema.raffle.id || !schema.raffle.campaignId) {
      return setJson(res, 500, {
        ok: false,
        error: "Could not resolve raffle_configs id / campaign columns",
        schema,
      });
    }

    if (!schema.campaigns.id || !schema.campaigns.tenantId) {
      return setJson(res, 500, {
        ok: false,
        error: "Could not resolve campaigns id / tenant columns",
        schema,
      });
    }

    const tenant = await getTenantBySlug(db, tenantSlug, schema);

    if (!tenant) {
      return setJson(res, 404, {
        ok: false,
        error: `Tenant not found for slug "${tenantSlug}"`,
      });
    }

    const existingResult = await db.query(
      `
      select rc.${qi(schema.raffle.id)} as id
      from raffle_configs rc
      inner join campaigns c
        on c.${qi(schema.campaigns.id)} = rc.${qi(schema.raffle.campaignId)}
      where rc.${qi(schema.raffle.id)} = $1
        and c.${qi(schema.campaigns.tenantId)} = $2
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
      where ${qi(schema.raffle.id)} = $1
      returning ${qi(schema.raffle.id)} as id
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
      deletedId: result.rows[0].id,
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
