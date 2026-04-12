import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPublicRaffleBySlug } from "../../_lib/raffles-repo";
import { resolveTenantSlug } from "../../_lib/tenant";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const tenantSlug = resolveTenantSlug(req);
  const slug = req.query.slug;

  if (typeof slug !== "string" || !slug.trim()) {
    return res.status(400).json({ error: "Invalid raffle slug." });
  }

  try {
    const raffle = await getPublicRaffleBySlug(tenantSlug, slug);

    if (!raffle) {
      return res.status(404).json({
        error: `No public raffle found for tenant="${tenantSlug}" slug="${slug}". Check that the raffle exists and status is "published" or "closed".`,
      });
    }

    return res.status(200).json({ raffle });
  } catch (error) {
    console.error("PUBLIC RAFFLE LOOKUP FAILED", error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? `Runtime error: ${error.message}`
          : "Runtime error",
      tenantSlug,
      slug,
    });
  }
}
