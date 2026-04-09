import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createRaffleId,
  getRaffleStore,
  getSoldTicketCount,
  normalizeSlug,
  type Raffle,
  type RaffleStatus,
} from "../_lib/rafflestore";

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

function isValidStatus(value: unknown): value is RaffleStatus {
  return value === "draft" || value === "published" || value === "closed";
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const store = getRaffleStore();
  const tenantId = readTenantId(req);

  if (req.method === "GET") {
    const raffles = store.raffles
      .filter((item: Raffle) => item.tenantId === tenantId)
      .sort((a: Raffle, b: Raffle) => b.createdAt.localeCompare(a.createdAt))
      .map((raffle: Raffle) => {
        const soldTickets = getSoldTicketCount(raffle.id);
        const remainingTickets = Math.max(raffle.maxTickets - soldTickets, 0);

        return {
          ...raffle,
          soldTickets,
          remainingTickets,
        };
      });

    return sendJson(res, 200, { raffles });
  }

  if (req.method === "POST") {
    const title =
      typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const description =
      typeof req.body?.description === "string"
        ? req.body.description.trim()
        : "";
    const rawSlug =
      typeof req.body?.slug === "string" ? req.body.slug.trim() : "";
    const slug = normalizeSlug(rawSlug);
    const ticketPrice = Number(req.body?.ticketPrice);
    const maxTickets = Number(req.body?.maxTickets);
    const endAt =
      typeof req.body?.endAt === "string" && req.body.endAt.trim()
        ? req.body.endAt.trim()
        : null;
    const status: RaffleStatus = req.body?.isPublished ? "published" : "draft";
    const isPublished = status === "published";

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
      return sendJson(res, 400, {
        message: "Ticket price must be a valid number",
      });
    }

    if (!Number.isInteger(maxTickets) || maxTickets < 1) {
      return sendJson(res, 400, {
        message: "Max tickets must be at least 1",
      });
    }

    const duplicateSlug = store.raffles.some(
      (item: Raffle) => item.tenantId === tenantId && item.slug === slug
    );

    if (duplicateSlug) {
      return sendJson(res, 400, {
        message: "Slug already exists for this tenant",
      });
    }

    const now = new Date().toISOString();

    const raffle: Raffle = {
      id: createRaffleId(),
      tenantId,
      title,
      slug,
      description,
      ticketPrice,
      maxTickets,
      isPublished,
      status,
      endAt,
      createdAt: now,
      updatedAt: now,
    };

    store.raffles.unshift(raffle);

    return sendJson(res, 201, {
      raffle: {
        ...raffle,
        soldTickets: 0,
        remainingTickets: raffle.maxTickets,
      },
    });
  }

  if (req.method === "PATCH") {
    const id = typeof req.body?.id === "string" ? req.body.id : "";
    const raffle = store.raffles.find(
      (item: Raffle) => item.id === id && item.tenantId === tenantId
    );

    if (!raffle) {
      return sendJson(res, 404, { message: "Raffle not found" });
    }

    const nextTitle =
      typeof req.body?.title === "string" ? req.body.title.trim() : raffle.title;

    const nextDescription =
      typeof req.body?.description === "string"
        ? req.body.description.trim()
        : raffle.description;

    const nextSlug =
      typeof req.body?.slug === "string"
        ? normalizeSlug(req.body.slug)
        : raffle.slug;

    const nextTicketPrice =
      req.body?.ticketPrice !== undefined
        ? Number(req.body.ticketPrice)
        : raffle.ticketPrice;

    const nextMaxTickets =
      req.body?.maxTickets !== undefined
        ? Number(req.body.maxTickets)
        : raffle.maxTickets;

    const nextEndAt =
      req.body?.endAt !== undefined
        ? typeof req.body.endAt === "string" && req.body.endAt.trim()
          ? req.body.endAt.trim()
          : null
        : raffle.endAt;

    const requestedStatus =
      req.body?.status !== undefined ? req.body.status : raffle.status;

    if (!nextTitle) {
      return sendJson(res, 400, { message: "Title is required" });
    }

    if (!nextSlug) {
      return sendJson(res, 400, { message: "Slug is required" });
    }

    if (!nextDescription) {
      return sendJson(res, 400, { message: "Description is required" });
    }

    if (!Number.isFinite(nextTicketPrice) || nextTicketPrice < 0) {
      return sendJson(res, 400, {
        message: "Ticket price must be a valid number",
      });
    }

    if (!Number.isInteger(nextMaxTickets) || nextMaxTickets < 1) {
      return sendJson(res, 400, {
        message: "Max tickets must be at least 1",
      });
    }

    if (!isValidStatus(requestedStatus)) {
      return sendJson(res, 400, { message: "Invalid raffle status" });
    }

    const duplicateSlug = store.raffles.some(
      (item: Raffle) =>
        item.tenantId === tenantId &&
        item.slug === nextSlug &&
        item.id !== raffle.id
    );

    if (duplicateSlug) {
      return sendJson(res, 400, {
        message: "Slug already exists for this tenant",
      });
    }

    const soldTickets = getSoldTicketCount(raffle.id);

    if (nextMaxTickets < soldTickets) {
      return sendJson(res, 400, {
        message: `Max tickets cannot be less than sold tickets (${soldTickets})`,
      });
    }

    raffle.title = nextTitle;
    raffle.description = nextDescription;
    raffle.slug = nextSlug;
    raffle.ticketPrice = nextTicketPrice;
    raffle.maxTickets = nextMaxTickets;
    raffle.endAt = nextEndAt;
    raffle.status = requestedStatus;
    raffle.isPublished = requestedStatus === "published";
    raffle.updatedAt = new Date().toISOString();

    return sendJson(res, 200, {
      raffle: {
        ...raffle,
        soldTickets,
        remainingTickets: Math.max(raffle.maxTickets - soldTickets, 0),
      },
    });
  }

  if (req.method === "DELETE") {
    const id = typeof req.body?.id === "string" ? req.body.id : "";

    const index = store.raffles.findIndex(
      (item: Raffle) => item.id === id && item.tenantId === tenantId
    );

    if (index === -1) {
      return sendJson(res, 404, { message: "Raffle not found" });
    }

    const deleted = store.raffles[index];
    store.raffles.splice(index, 1);

    return sendJson(res, 200, { raffle: deleted, success: true });
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return sendJson(res, 405, { message: "Method not allowed" });
}
