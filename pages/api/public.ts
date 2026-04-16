import { getRaffleBySlug } from "./_lib/raffles-repo";
import {
  getQueryValue,
  sendBadRequest,
  sendNotFound,
  sendServerError,
  type ApiRequest,
  type ApiResponse,
} from "./_lib/http";

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  try {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const slug = getQueryValue(req, "slug");
    const tenantSlug = getQueryValue(req, "tenantSlug") ?? "demo-a";

    if (!slug) {
      sendBadRequest(res, "Missing slug");
      return;
    }

    const raffle = await getRaffleBySlug(tenantSlug, slug);

    if (!raffle) {
      sendNotFound(res, "Raffle not found");
      return;
    }

    res.status(200).json({
      ok: true,
      item: raffle,
    });
  } catch (error) {
    sendServerError(res, error);
  }
}
