import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createRaffleId,
  getRaffleStore,
  normalizeSlug,
  type Raffle,
import { ... } from "../lib/raffleStore";

function sendJson(res: VercelResponse, status: number, payload: unknown) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(payload));
}

function readTenantId(req: VercelRequest) {
  const headerTenant = req.headers["x-tenant-id"];

  if (typeof headerTenant === "string" && headerTenant.trim()) {
    return headerTenant.trim();
  }

  return "demo-a";
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const store = getRaffleStore();

  if (req.method === "GET") {
    const tenantId = readTenantId(req);

    const raffles = store.raffles
      .filter((item: Raffle) => item.tenantId === tenantId)
      .sort((a: Raffle, b: Raffle) => b.createdAt.localeCompare(a.createdAt));

    return sendJson(res, 200, { raffles });
  }

  if (req.method === "POST") {
    const tenantId = readTenantId(req);

    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const description =
      typeof req.body?.description === "string" ? req.body.description.trim() : "";
    const rawSlug = typeof req.body?.slug === "string" ? req.body.slug : "";
    const slug = normalizeSlug(rawSlug);
    const ticketPrice = Number(req.body?.ticketPrice);
    const maxTickets = Number(req.body?.maxTickets);
    const isPublished = Boolean(req.body?.isPublished);

    if (!title) {
      return sendJson(res, 400, { message: "Title is required" });
    }

    if (!slug) {
      return sendJson(res, 400, { message: "Slug is required" });
    }

    if (!description) {
      return sendJson(res, 400, { message: "Description is required" });
    }

    if (!Number.isFinite(ticketPrice) || ticketPrice < 0) {
      return sendJson(res, 400, { message: "Ticket price must be a valid number" });
    }

    if (!Number.isInteger(maxTickets) || maxTickets < 1) {
      return sendJson(res, 400, { message: "Max tickets must be at least 1" });
    }

    const duplicateSlug = store.raffles.some(
      (item: Raffle) => item.tenantId === tenantId && item.slug === slug
    );

    if (duplicateSlug) {
      return sendJson(res, 400, { message: "Slug already exists for this tenant" });
    }

    const raffle: Raffle = {
      id: createRaffleId(),
      tenantId,
      title,
      slug,
      description,
      ticketPrice,
      maxTickets,
      isPublished,
      createdAt: new Date().toISOString(),
    };

    store.raffles.unshift(raffle);

    return sendJson(res, 201, { raffle });
  }

  res.setHeader("Allow", "GET, POST");
  return sendJson(res, 405, { message: "Method not allowed" });
}
