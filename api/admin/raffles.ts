import type { NextApiRequest, NextApiResponse } from "next";

type ColourOption = {
  name: string;
  hex: string;
};

type OfferOption = {
  label: string;
  price: number;
  entries: number;
};

type ErrorResponse = {
  ok: false;
  error: string;
};

type SuccessResponse = {
  ok: true;
  [key: string]: any;
};

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

function sendMethodNotAllowed(
  res: NextApiResponse<ErrorResponse>,
  allowed: string[]
) {
  res.setHeader("Allow", allowed.join(", "));
  return res.status(405).json({
    ok: false,
    error: "Method not allowed",
  });
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normaliseColours(input: unknown): ColourOption[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      const raw = item as Record<string, unknown>;

      const name = asTrimmedString(raw?.name);
      const hex = asTrimmedString(raw?.hex);

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
      const raw = item as Record<string, unknown>;

      const label = asTrimmedString(raw?.label);
      const price = asNumber(raw?.price);
      const entries = asNumber(raw?.entries);

      if (!label) return null;
      if (price <= 0) return null;
      if (!Number.isInteger(entries) || entries <= 0) return null;

      return {
        label,
        price,
        entries,
      };
    })
    .filter(Boolean) as OfferOption[];
}

function parseId(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
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

/**
 * Picks the first campaign for the tenant if campaignId is not supplied.
 * This keeps the admin flow moving while auth/real tenant admin is still incomplete.
 */
async function resolveCampaignIdForTenant(
  db: any,
  tenantId: number,
  campaignId?: unknown
): Promise<number | null> {
  const explicitCampaignId = parseId(campaignId);

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

    return explicit.rows[0]?.id ?? null;
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

async function listRaffles(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  try {
    const tenantSlug = asTrimmedString(req.query.tenantSlug || "demo-a") || "demo-a";

    const { getDb } = await import("../_lib/db.js");
    const db = getDb();

    const tenant = await getTenantBySlug(db, tenantSlug);
    if (!tenant) {
      return res.status(404).json({
        ok: false,
        error: `Tenant not found for slug "${tenantSlug}"`,
      });
    }

    const result = await db.query(
      `
      select
        rc.id,
        rc.tenant_id,
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
      left join campaigns c on c.id = rc.campaign_id
      where rc.tenant_id = $1
      order by
        coalesce(rc.sort_order, 999999) asc,
        rc.created_at desc,
        rc.id desc
      `,
      [tenant.id]
    );

    return res.status(200).json({
      ok: true,
      raffles: result.rows.map((row: any) => ({
        id: row.id,
        tenantId: row.tenant_id,
        campaignId: row.campaign_id,
        campaignTitle: row.campaign_title,
        title: row.title,
        description: row.description,
        status: row.status,
        sortOrder: row.sort_order,
        colours: Array.isArray(row.colours) ? row.colours : [],
        offers: Array.isArray(row.offers) ? row.offers : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    console.error("GET /api/admin/raffles error", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to load raffles",
    });
  }
}

async function createRaffle(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  try {
    const tenantSlug = asTrimmedString(req.body?.tenantSlug || "demo-a") || "demo-a";
    const title = asTrimmedString(req.body?.title);
    const description = asTrimmedString(req.body?.description);
    const status = asTrimmedString(req.body?.status) || "active";
    const sortOrder = asNumber(req.body?.sortOrder, 0);
    const colours = normaliseColours(req.body?.colours);
    const offers = normaliseOffers(req.body?.offers);

    if (!title) {
      return res.status(400).json({
        ok: false,
        error: "Title is required",
      });
    }

    const { getDb } = await import("../_lib/db.js");
    const db = getDb();

    const tenant = await getTenantBySlug(db, tenantSlug);
    if (!tenant) {
      return res.status(404).json({
        ok: false,
        error: `Tenant not found for slug "${tenantSlug}"`,
      });
    }

    const campaignId = await resolveCampaignIdForTenant(
      db,
      tenant.id,
      req.body?.campaignId
    );

    if (!campaignId) {
      return res.status(400).json({
        ok: false,
        error:
          "No campaign found for this tenant. Create a campaign first or pass a valid campaignId.",
      });
    }

    const insertResult = await db.query(
      `
      insert into raffle_configs (
        tenant_id,
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
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, now(), now())
      returning
        id,
        tenant_id,
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
        tenant.id,
        campaignId,
        title,
        description || null,
        status,
        sortOrder,
        JSON.stringify(colours),
        JSON.stringify(offers),
      ]
    );

    const raffle = insertResult.rows[0];

    return res.status(201).json({
      ok: true,
      raffle: {
        id: raffle.id,
        tenantId: raffle.tenant_id,
        campaignId: raffle.campaign_id,
        title: raffle.title,
        description: raffle.description,
        status: raffle.status,
        sortOrder: raffle.sort_order,
        colours: Array.isArray(raffle.colours) ? raffle.colours : [],
        offers: Array.isArray(raffle.offers) ? raffle.offers : [],
        createdAt: raffle.created_at,
        updatedAt: raffle.updated_at,
      },
    });
  } catch (error) {
    console.error("POST /api/admin/raffles error", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to create raffle",
    });
  }
}

async function updateRaffle(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  try {
    const id = parseId(req.body?.id);
    const tenantSlug = asTrimmedString(req.body?.tenantSlug || "demo-a") || "demo-a";

    if (!id) {
      return res.status(400).json({
        ok: false,
        error: "Valid raffle id is required",
      });
    }

    const title = asTrimmedString(req.body?.title);
    const description = asTrimmedString(req.body?.description);
    const status = asTrimmedString(req.body?.status) || "active";
    const sortOrder = asNumber(req.body?.sortOrder, 0);
    const colours = normaliseColours(req.body?.colours);
    const offers = normaliseOffers(req.body?.offers);

    if (!title) {
      return res.status(400).json({
        ok: false,
        error: "Title is required",
      });
    }

    const { getDb } = await import("../_lib/db.js");
    const db = getDb();

    const tenant = await getTenantBySlug(db, tenantSlug);
    if (!tenant) {
      return res.status(404).json({
        ok: false,
        error: `Tenant not found for slug "${tenantSlug}"`,
      });
    }

    const existingResult = await db.query(
      `
      select id, tenant_id, campaign_id
      from raffle_configs
      where id = $1 and tenant_id = $2
      limit 1
      `,
      [id, tenant.id]
    );

    const existing = existingResult.rows[0];
    if (!existing) {
      return res.status(404).json({
        ok: false,
        error: "Raffle not found",
      });
    }

    const resolvedCampaignId =
      (await resolveCampaignIdForTenant(db, tenant.id, req.body?.campaignId)) ||
      existing.campaign_id;

    const updateResult = await db.query(
      `
      update raffle_configs
      set
        campaign_id = $3,
        title = $4,
        description = $5,
        status = $6,
        sort_order = $7,
        colours = $8::jsonb,
        offers = $9::jsonb,
        updated_at = now()
      where id = $1 and tenant_id = $2
      returning
        id,
        tenant_id,
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
        tenant.id,
        resolvedCampaignId,
        title,
        description || null,
        status,
        sortOrder,
        JSON.stringify(colours),
        JSON.stringify(offers),
      ]
    );

    const raffle = updateResult.rows[0];

    return res.status(200).json({
      ok: true,
      raffle: {
        id: raffle.id,
        tenantId: raffle.tenant_id,
        campaignId: raffle.campaign_id,
        title: raffle.title,
        description: raffle.description,
        status: raffle.status,
        sortOrder: raffle.sort_order,
        colours: Array.isArray(raffle.colours) ? raffle.colours : [],
        offers: Array.isArray(raffle.offers) ? raffle.offers : [],
        createdAt: raffle.created_at,
        updatedAt: raffle.updated_at,
      },
    });
  } catch (error) {
    console.error("PUT /api/admin/raffles error", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to update raffle",
    });
  }
}

async function deleteRaffle(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  try {
    const id = parseId(req.body?.id ?? req.query?.id);
    const tenantSlug =
      asTrimmedString(req.body?.tenantSlug ?? req.query?.tenantSlug ?? "demo-a") ||
      "demo-a";

    if (!id) {
      return res.status(400).json({
        ok: false,
        error: "Valid raffle id is required",
      });
    }

    const { getDb } = await import("../_lib/db.js");
    const db = getDb();

    const tenant = await getTenantBySlug(db, tenantSlug);
    if (!tenant) {
      return res.status(404).json({
        ok: false,
        error: `Tenant not found for slug "${tenantSlug}"`,
      });
    }

    const deleteResult = await db.query(
      `
      delete from raffle_configs
      where id = $1 and tenant_id = $2
      returning id
      `,
      [id, tenant.id]
    );

    if (!deleteResult.rows[0]) {
      return res.status(404).json({
        ok: false,
        error: "Raffle not found",
      });
    }

    return res.status(200).json({
      ok: true,
      deletedId: id,
    });
  } catch (error) {
    console.error("DELETE /api/admin/raffles error", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to delete raffle",
    });
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method === "GET") {
    return listRaffles(req, res);
  }

  if (req.method === "POST") {
    return createRaffle(req, res);
  }

  if (req.method === "PUT") {
    return updateRaffle(req, res);
  }

  if (req.method === "DELETE") {
    return deleteRaffle(req, res);
  }

  return sendMethodNotAllowed(res, ["GET", "POST", "PUT", "DELETE"]);
}
