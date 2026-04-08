import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";
import { users, tenants } from "../_lib/store";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/auth_token=([^;]+)/);
  const token = match?.[1];

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      tenantId: string;
    };

    const user = users.find((u) => u.id === decoded.userId);
    const tenant = tenants.find((t) => t.id === decoded.tenantId);

    if (!user || !tenant) {
      return res.status(404).json({ error: "User or tenant not found" });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
    });
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }
}
