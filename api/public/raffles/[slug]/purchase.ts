import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createPurchase, resolveTenantSlug } from "../../../_lib/raffles-repo";

type PurchaseBody = {
  name?: unknown;
  email?: unknown;
  quantity?: unknown;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const tenantSlug = resolveTenantSlug(req);
  const slug = req.query.slug;

  if (typeof slug !== "string" || !slug.trim()) {
    return res.status(400).json({ error: "Invalid raffle slug." });
  }

  const body = (req.body ?? {}) as PurchaseBody;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const quantity = Number(body.quantity);

  if (!name) {
    return res.status(400).json({ error: "Name is required." });
  }

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "A valid email is required." });
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res
      .status(400)
      .json({ error: "Quantity must be a whole number greater than 0." });
  }

  if (quantity > 20) {
    return res
      .status(400)
      .json({ error: "Maximum quantity per purchase is 20." });
  }

  try {
    const result = await createPurchase({
      tenantSlug,
      raffleSlug: slug,
      customerName: name,
      customerEmail: email,
      quantity,
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.message });
    }

    return res.status(201).json({
      message: "Purchase created successfully.",
      purchase: result.purchase,
      raffle: result.raffle,
    });
  } catch (error) {
    console.error("POST /api/public/raffles/[slug]/purchase failed", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}
