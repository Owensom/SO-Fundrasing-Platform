import { requireAdmin } from "./_lib/auth";
import {
  createRaffle,
  getRaffleById,
  listPurchasesByRaffleId,
  listRaffles,
  updateRaffle,
  type CreateRaffleInput,
  type UpdateRaffleInput,
} from "./_lib/raffles-repo";
import {
  getJsonBody,
  getQueryValue,
  sendBadRequest,
  sendMethodNotAllowed,
  sendNotFound,
  sendServerError,
  sendUnauthorized,
  type ApiRequest,
  type ApiResponse,
} from "./_lib/http";

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  try {
    requireAdmin(req);

    const resource = getQueryValue(req, "resource");

    if (req.method === "GET" && resource === "raffles") {
      const items = await listRaffles();
      res.status(200).json({ ok: true, items });
      return;
    }

    if (req.method === "GET" && resource === "raffle") {
      const id = getQueryValue(req, "id");
      if (!id) {
        sendBadRequest(res, "Missing id");
        return;
      }

      const raffle = await getRaffleById(id);
      if (!raffle) {
        sendNotFound(res, "Raffle not found");
        return;
      }

      res.status(200).json({ ok: true, item: raffle });
      return;
    }

    if (req.method === "GET" && resource === "purchases") {
      const raffleId = getQueryValue(req, "raffleId");
      if (!raffleId) {
        sendBadRequest(res, "Missing raffleId");
        return;
      }

      const items = await listPurchasesByRaffleId(raffleId);
      res.status(200).json({ ok: true, items });
      return;
    }

    if (req.method === "POST" && resource === "raffles") {
      const body = getJsonBody<CreateRaffleInput>(req);

      if (!body.title?.trim()) {
        sendBadRequest(res, "Title is required");
        return;
      }

      if (!body.slug?.trim()) {
        sendBadRequest(res, "Slug is required");
        return;
      }

      const created = await createRaffle({
        ...body,
        title: body.title.trim(),
        slug: body.slug.trim(),
      });

      res.status(201).json({ ok: true, item: created });
      return;
    }

    if (req.method === "PUT" && resource === "raffle") {
      const id = getQueryValue(req, "id");
      if (!id) {
        sendBadRequest(res, "Missing id");
        return;
      }

      const body = getJsonBody<UpdateRaffleInput>(req);

      if (!body.title?.trim()) {
        sendBadRequest(res, "Title is required");
        return;
      }

      if (!body.slug?.trim()) {
        sendBadRequest(res, "Slug is required");
        return;
      }

      const updated = await updateRaffle(id, {
        ...body,
        title: body.title.trim(),
        slug: body.slug.trim(),
      });

      if (!updated) {
        sendNotFound(res, "Raffle not found");
        return;
      }

      res.status(200).json({ ok: true, item: updated });
      return;
    }

    sendMethodNotAllowed(res, ["GET", "POST", "PUT"]);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      sendUnauthorized(res);
      return;
    }

    sendServerError(res, error);
  }
}
