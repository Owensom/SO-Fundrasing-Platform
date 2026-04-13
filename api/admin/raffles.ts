type JsonRecord = Record<string, unknown>;

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

function asInteger(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function getQueryValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function randomSuffix(length = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function buildCampaignId(slug: string) {
  return `campaign_${slug}_${randomSuffix(6)}`;
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
      createdAt: row.raffle_created_at,
      updatedAt: row.raffle_updated_at,
    },
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
        rc.created_at as raffle_created_at,
        rc.updated_at as raffle_updated_at
      from campaigns c
      left join raffle_configs rc
        on rc.campaign_id = c.id
      where c.tenant_id = $1
        and c.type = 'raffle'
      order by c.created_at desc, c.id desc
      `,
      [tenant.id]
    );

    return setJson(res, 200, {
      ok: true,
      raffles: result.rows.map(mapRow),
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
    const heroImageUrl = asOptionalString(body.heroImageUrl ?? body.hero_image_url);
    const status = asTrimmedString(body.status) || "draft";
    const startsAt = asOptionalString(body.startsAt ?? body.starts_at);
    const endsAt = asOptionalString(body.endsAt ?? body.ends_at);

    const singleTicketPriceCents = asInteger(
      body.singleTicketPriceCents ?? body.single_ticket_price_cents,
      0
    );
    const totalTickets = asInteger(
      body.totalTickets ?? body.total_tickets,
      0
    );
    const soldTickets = asInteger(
      body.soldTickets ?? body.sold_tickets,
      0
    );
    const backgroundImageUrl = asOptionalString(
      body.backgroundImageUrl ?? body.background_image_url
    );

    if (!title) {
      return setJson(res, 400, {
        ok: false,
        error: "Title is required",
      });
    }

    if (singleTicketPriceCents <= 0) {
      return setJson(res, 400, {
        ok: false,
        error: "singleTicketPriceCents must be greater than 0",
      });
    }

    if (totalTickets <= 0) {
      return setJson(res, 400, {
        ok: false,
        error: "totalTickets must be greater than 0",
      });
    }

    if (soldTickets < 0) {
      return setJson(res, 400, {
        ok: false,
        error: "soldTickets cannot be negative",
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

    const baseSlug = slugify(asTrimmedString(body.slug) || title);
    const finalSlug = baseSlug || `raffle-${randomSuffix(6)}`;

    let campaignId = asTrimmedString(body.id ?? body.campaignId);
    if (!campaignId) {
      campaignId = buildCampaignId(finalSlug);
    }

    await db.query("begin");

    try {
      const existingCampaign = await db.query(
        `
        select id
        from campaigns
        where id = $1
        limit 1
        `,
        [campaignId]
      );

      if (existingCampaign.rows[0]) {
        await db.query("rollback");
        return setJson(res, 409, {
          ok: false,
          error: `Campaign id already exists: ${campaignId}`,
        });
      }

      const existingSlug = await db.query(
        `
        select id
        from campaigns
        where slug = $1 and tenant_id = $2
        limit 1
        `,
        [finalSlug, tenant.id]
      );

      if (existingSlug.rows[0]) {
        await db.query("rollback");
        return setJson(res, 409, {
          ok: false,
          error: `Slug already exists for tenant: ${finalSlug}`,
        });
      }

      const campaignInsert = await db.query(
        `
        insert into campaigns (
          id,
          tenant_id,
          type,
          slug,
          title,
          description,
          hero_image_url,
          status,
          starts_at,
          ends_at,
          created_at,
          updated_at
        )
        values ($1, $2, 'raffle', $3, $4, $5, $6, $7, $8, $9, now(), now())
        returning
          id,
          tenant_id,
          type,
          slug,
          title,
          description,
          hero_image_url,
          status,
          starts_at,
          ends_at,
          created_at,
          updated_at
        `,
        [
          campaignId,
          tenant.id,
          finalSlug,
          title,
          description,
          heroImageUrl,
          status,
          startsAt,
          endsAt,
        ]
      );

      await db.query(
        `
        insert into raffle_configs (
          campaign_id,
          single_ticket_price_cents,
          total_tickets,
          sold_tickets,
          background_image_url,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, now(), now())
        `,
        [
          campaignId,
          singleTicketPriceCents,
          totalTickets,
          soldTickets,
          backgroundImageUrl,
        ]
      );

      await db.query("commit");

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
          rc.created_at as raffle_created_at,
          rc.updated_at as raffle_updated_at
        from campaigns c
        left join raffle_configs rc
          on rc.campaign_id = c.id
        where c.id = $1
        limit 1
        `,
        [campaignInsert.rows[0].id]
      );

      return setJson(res, 201, {
        ok: true,
        raffle: mapRow(result.rows[0]),
      });
    } catch (innerError) {
      await db.query("rollback");
      throw innerError;
    }
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

    const id = asTrimmedString(body.id ?? body.campaignId);
    const tenantSlug = asTrimmedString(body.tenantSlug || "demo-a") || "demo-a";

    if (!id) {
      return setJson(res, 400, {
        ok: false,
        error: "Valid raffle id is required",
      });
    }

    const title = asTrimmedString(body.title);
    const description = asOptionalString(body.description);
    const heroImageUrl = asOptionalString(body.heroImageUrl ?? body.hero_image_url);
    const status = asTrimmedString(body.status) || "draft";
    const startsAt = asOptionalString(body.startsAt ?? body.starts_at);
    const endsAt = asOptionalString(body.endsAt ?? body.ends_at);

    const singleTicketPriceCents = asInteger(
      body.singleTicketPriceCents ?? body.single_ticket_price_cents,
      0
    );
    const totalTickets = asInteger(
      body.totalTickets ?? body.total_tickets,
      0
    );
    const soldTickets = asInteger(
      body.soldTickets ?? body.sold_tickets,
      0
    );
    const backgroundImageUrl = asOptionalString(
      body.backgroundImageUrl ?? body.background_image_url
    );

    if (!title) {
      return setJson(res, 400, {
        ok: false,
        error: "Title is required",
      });
    }

    if (singleTicketPriceCents <= 0) {
      return setJson(res, 400, {
        ok: false,
        error: "singleTicketPriceCents must be greater than 0",
      });
    }

    if (totalTickets <= 0) {
      return setJson(res, 400, {
        ok: false,
        error: "totalTickets must be greater than 0",
      });
    }

    if (soldTickets < 0) {
      return setJson(res, 400, {
        ok: false,
        error: "soldTickets cannot be negative",
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

    const existing = await db.query(
      `
      select c.id, c.slug
      from campaigns c
      where c.id = $1
        and c.tenant_id = $2
        and c.type = 'raffle'
      limit 1
      `,
      [id, tenant.id]
    );

    if (!existing.rows[0]) {
      return setJson(res, 404, {
        ok: false,
        error: "Raffle not found",
      });
    }

    const requestedSlug = slugify(asTrimmedString(body.slug) || title);
    const finalSlug = requestedSlug || existing.rows[0].slug;

    const conflictingSlug = await db.query(
      `
      select id
      from campaigns
      where slug = $1
        and tenant_id = $2
        and id <> $3
      limit 1
      `,
      [finalSlug, tenant.id, id]
    );

    if (conflictingSlug.rows[0]) {
      return setJson(res, 409, {
        ok: false,
        error: `Slug already exists for tenant: ${finalSlug}`,
      });
    }

    await db.query("begin");

    try {
      await db.query(
        `
        update campaigns
        set
          slug = $2,
          title = $3,
          description = $4,
          hero_image_url = $5,
          status = $6,
          starts_at = $7,
          ends_at = $8,
          updated_at = now()
        where id = $1
        `,
        [
          id,
          finalSlug,
          title,
          description,
          heroImageUrl,
          status,
          startsAt,
          endsAt,
        ]
      );

      const existingConfig = await db.query(
        `
        select campaign_id
        from raffle_configs
        where campaign_id = $1
        limit 1
        `,
        [id]
      );

      if (existingConfig.rows[0]) {
        await db.query(
          `
          update raffle_configs
          set
            single_ticket_price_cents = $2,
            total_tickets = $3,
            sold_tickets = $4,
            background_image_url = $5,
            updated_at = now()
          where campaign_id = $1
          `,
          [
            id,
            singleTicketPriceCents,
            totalTickets,
            soldTickets,
            backgroundImageUrl,
          ]
        );
      } else {
        await db.query(
          `
          insert into raffle_configs (
            campaign_id,
            single_ticket_price_cents,
            total_tickets,
            sold_tickets,
            background_image_url,
            created_at,
            updated_at
          )
          values ($1, $2, $3, $4, $5, now(), now())
          `,
          [
            id,
            singleTicketPriceCents,
            totalTickets,
            soldTickets,
            backgroundImageUrl,
          ]
        );
      }

      await db.query("commit");

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
          rc.created_at as raffle_created_at,
          rc.updated_at as raffle_updated_at
        from campaigns c
        left join raffle_configs rc
          on rc.campaign_id = c.id
        where c.id = $1
        limit 1
        `,
        [id]
      );

      return setJson(res, 200, {
        ok: true,
        raffle: mapRow(result.rows[0]),
      });
    } catch (innerError) {
      await db.query("rollback");
      throw innerError;
    }
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

    const id = asTrimmedString(body.id ?? getQueryValue(req.query?.id));
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

    const existing = await db.query(
      `
      select id
      from campaigns
      where id = $1
        and tenant_id = $2
        and type = 'raffle'
      limit 1
      `,
      [id, tenant.id]
    );

    if (!existing.rows[0]) {
      return setJson(res, 404, {
        ok: false,
        error: "Raffle not found",
      });
    }

    await db.query("begin");

    try {
      await db.query(
        `
        delete from raffle_configs
        where campaign_id = $1
        `,
        [id]
      );

      await db.query(
        `
        delete from campaigns
        where id = $1
        `,
        [id]
      );

      await db.query("commit");

      return setJson(res, 200, {
        ok: true,
        deletedId: id,
      });
    } catch (innerError) {
      await db.query("rollback");
      throw innerError;
    }
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
