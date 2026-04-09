import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getRaffleStore,
  normalizeSlug,
  type Raffle,
} from "../../_lib/rafflestore";

function sendJson(
  res: VercelResponse,
  status: number,
  payload: unknown
): VercelResponse {
  res.status(status).setHeader("Content-Type", "application/json");
  return res.send(JSON.stringify(payload));
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
      typeof req.query.slug === "string" ? req.query.slug : "";
    const slug = normalizeSlug(rawSlug);

    if (!slug) {
      return sendJson(res, 400, { message: "Missing raffle slug" });
    }

    const store = getRaffleStore();

    const raffle = store.raffles.find(
      (item: Raffle) =>
        item.tenantId === tenantId &&
        item.slug === slug &&
        item.isPublished
    );

    if (!raffle) {
      return sendJson(res, 404, {
        message: `Raffle not found for tenant "${tenantId}" and slug "${slug}"`,
      });
    }

    return sendJson(res, 200, raffle);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";

    return sendJson(res, 500, {
      message: "Server error loading raffle",
      error: message,
    });
  }
}
