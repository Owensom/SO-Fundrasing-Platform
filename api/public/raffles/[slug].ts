import type { VercelRequest, VercelResponse } from "@vercel/node";

type Raffle = {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  description: string;
  ticketPrice: number;
  maxTickets: number;
  isPublished: boolean;
  status: "draft" | "published" | "closed";
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
  soldTickets: number;
  remainingTickets: number;
};

function sendJson(res: VercelResponse, status: number, payload: unknown) {
  res.status(status).setHeader("Content-Type", "application/json");
  return res.send(JSON.stringify(payload));
}

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function readTenantId(req: VercelRequest): string {
  const headerTenant = req.headers["x-tenant-id"];

  if (typeof headerTenant === "string" && headerTenant.trim()) {
    return headerTenant.trim();
  }

  return "demo-a";
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return sendJson(res, 405, { message: "Method not allowed" });
    }

    const tenantId = readTenantId(req);
    const rawSlug =
      typeof req.query.slug === "string"
        ? req.query.slug
        : Array.isArray(req.query.slug)
        ? req.query.slug[0]
        : "";

    const slug = normalizeSlug(rawSlug);

    if (!slug) {
      return sendJson(res, 400, { message: "Missing raffle slug" });
    }

    const now = new Date().toISOString();

    const raffles: Raffle[] = [
      {
        id: "seed_demo_raffle",
        tenantId: "demo-a",
        title: "Demo Raffle",
        slug: "demo-raffle",
        description: "Demo raffle so your public page has data.",
        ticketPrice: 5,
        maxTickets: 100,
        isPublished: true,
        status: "published",
        endAt: null,
        createdAt: now,
        updatedAt: now,
        soldTickets: 0,
        remainingTickets: 100,
      },
    ];

    const raffle = raffles.find(
      (item) =>
        item.tenantId === tenantId &&
        item.slug === slug &&
        item.status === "published"
    );

    if (!raffle) {
      return sendJson(res, 404, {
        message: `Raffle not found for tenant "${tenantId}" and slug "${slug}"`,
      });
    }

    return sendJson(res, 200, raffle);
  } catch (error) {
    return sendJson(res, 500, {
      message: "Server error loading raffle",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
