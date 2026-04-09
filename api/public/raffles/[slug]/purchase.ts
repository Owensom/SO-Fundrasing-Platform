import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createPurchaseId,
  getRaffleStore,
  getSoldTicketCount,
  normalizeSlug,
  type Purchase,
  type Raffle,
} from "../../../_lib/rafflestore";

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

function isValidEmail(value: string): boolean {
  return /\S+@\S+\.\S+/.test(value);
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { message: "Method not allowed" });
    }

    const tenantId = readTenantId(req);
    const rawSlug = typeof req.query.slug === "string" ? req.query.slug : "";
    const slug = normalizeSlug(rawSlug);

    if (!slug) {
      return sendJson(res, 400, { message: "Missing raffle slug" });
    }

    const buyerName =
      typeof req.body?.buyerName === "string" ? req.body.buyerName.trim() : "";
    const buyerEmail =
      typeof req.body?.buyerEmail === "string" ? req.body.buyerEmail.trim() : "";
    const quantity = Number(req.body?.quantity);

    if (!buyerName) {
      return sendJson(res, 400, { message: "Buyer name is required" });
    }

    if (!buyerEmail || !isValidEmail(buyerEmail)) {
      return sendJson(res, 400, { message: "Valid buyer email is required" });
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return sendJson(res, 400, { message: "Quantity must be at least 1" });
    }

    const store = getRaffleStore();

    const raffle = store.raffles.find(
      (item: Raffle) =>
        item.tenantId === tenantId &&
        item.slug === slug &&
        item.status === "published"
    );

    if (!raffle) {
      return sendJson(res, 404, { message: "Published raffle not found" });
    }

    const soldTickets = getSoldTicketCount(raffle.id);
    const remainingTickets = Math.max(raffle.maxTickets - soldTickets, 0);

    if (remainingTickets < quantity) {
      return sendJson(res, 400, {
        message: `Only ${remainingTickets} ticket(s) remaining`,
      });
    }

    const purchase: Purchase = {
      id: createPurchaseId(),
      raffleId: raffle.id,
      raffleSlug: raffle.slug,
      tenantId,
      buyerName,
      buyerEmail,
      quantity,
      totalAmount: Number((quantity * raffle.ticketPrice).toFixed(2)),
      createdAt: new Date().toISOString(),
    };

    store.purchases.unshift(purchase);

    const nextSoldTickets = getSoldTicketCount(raffle.id);
    const nextRemainingTickets = Math.max(raffle.maxTickets - nextSoldTickets, 0);

    if (nextRemainingTickets === 0) {
      raffle.status = "closed";
      raffle.isPublished = false;
      raffle.updatedAt = new Date().toISOString();
    }

    return sendJson(res, 201, {
      purchase,
      soldTickets: nextSoldTickets,
      remainingTickets: nextRemainingTickets,
      raffleStatus: raffle.status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";

    return sendJson(res, 500, {
      message: "Server error creating purchase",
      error: message,
    });
  }
}
