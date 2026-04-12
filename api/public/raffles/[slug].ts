import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createPendingPurchase } from "../../../_lib/raffles-repo";
import { resolveTenantSlug } from "../../../_lib/tenant";

type PurchaseBody = {
  customerName?: string;
  customerEmail?: string;
  quantity?: number | string;
};

function parseQuantity(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed." });
    }

    const tenantSlug = resolveTenantSlug(req);
    const slug = req.query.slug;

    if (typeof slug !== "string" || !slug.trim()) {
      return res.status(400).json({ error: "Invalid raffle slug." });
    }

    const body =
      typeof req.body === "object" && req.body !== null
        ? (req.body as PurchaseBody)
        : {};

    const customerName =
      typeof body.customerName === "string" ? body.customerName.trim() : "";
    const customerEmail =
      typeof body.customerEmail === "string" ? body.customerEmail.trim() : "";
    const quantityValue = parseQuantity(body.quantity);

    if (!customerName) {
      return res.status(400).json({ error: "Customer name is required." });
    }

    if (!customerEmail) {
      return res.status(400).json({ error: "Customer email is required." });
    }

    if (
      quantityValue === null ||
      !Number.isInteger(quantityValue) ||
      quantityValue <= 0
    ) {
      return res.status(400).json({ error: "Quantity must be a whole number." });
    }

    const result = await createPendingPurchase({
      tenantSlug,
      raffleSlug: slug,
      customerName,
      customerEmail,
      quantity: quantityValue,
    });

    if (result.ok === false) {
      const statusCode: number = result.status;
      return res.status(statusCode).json({ error: result.message });
    }

    return res.status(200).json({
      purchase: result.purchase,
      raffle: result.raffle,
    });
  } catch (error) {
    console.error("POST /api/public/raffles/[slug]/purchase failed", error);

    const statusCode: number = 500;
    return res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Internal server error.",
    });
  }
}
