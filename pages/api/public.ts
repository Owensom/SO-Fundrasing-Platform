import type { NextApiRequest, NextApiResponse } from "next";
import { getRaffleBySlug } from "../../api/_lib/raffles-repo";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const slug =
      typeof req.query.slug === "string" ? req.query.slug.trim() : "";

    const tenantSlug =
      typeof req.query.tenantSlug === "string"
        ? req.query.tenantSlug
        : "demo-a";

    if (!slug) {
      return res.status(400).json({ error: "Missing slug" });
    }

    const raffle = await getRaffleBySlug(tenantSlug, slug);

    if (!raffle) {
      return res.status(404).json({ error: "Raffle not found" });
    }

    return res.status(200).json({ item: raffle });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Internal server error",
    });
  }
}
