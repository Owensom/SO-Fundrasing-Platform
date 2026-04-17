import type { NextApiRequest, NextApiResponse } from "next";
import {
  getRaffleById,
  getRaffleBySlug,
} from "../../../api/_lib/raffles-repo";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    const tenantSlug =
      typeof req.query.tenantSlug === "string" ? req.query.tenantSlug : "demo-a";

    if (!id) {
      return res.status(400).json({ error: "Missing raffle id" });
    }

    let raffle = await getRaffleById(id);

    if (!raffle) {
      raffle = await getRaffleBySlug(tenantSlug, id);
    }

    if (!raffle) {
      return res.status(404).json({ error: "Raffle not found" });
    }

    return res.status(200).json({ raffle });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Internal server error",
    });
  }
}
