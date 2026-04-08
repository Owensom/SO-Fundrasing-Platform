import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { tenants, users, nowIso, slugify } from "../_lib/store";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";

function uniqueTenantSlug(name: string) {
  const base = slugify(name) || "tenant";
  let slug = base;
  let counter = 2;

  while (tenants.some((t) => t.slug === slug)) {
    slug = `${base}-${counter}`;
    counter += 1;
  }

  return slug;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password, tenantName } = req.body ?? {};

  if (!email || !password || !tenantName) {
    return res.status(400).json({ error: "Email, password and tenant name are required" });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  if (users.some((u) => u.email === normalizedEmail)) {
    return res.status(409).json({ error: "Email already exists" });
  }

  const tenantId = randomUUID();
  const tenantSlug = uniqueTenantSlug(String(tenantName));
  const passwordHash = await bcrypt.hash(String(password), 12);

  const tenant = {
    id: tenantId,
    name: String(tenantName).trim(),
    slug: tenantSlug,
    isActive: true,
    createdAt: nowIso(),
  };

  const user = {
    id: randomUUID(),
    tenantId,
    email: normalizedEmail,
    passwordHash,
    role: "owner" as const,
    isActive: true,
    createdAt: nowIso(),
  };

  tenants.push(tenant);
  users.push(user);

  const token = jwt.sign(
    {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.setHeader(
    "Set-Cookie",
    `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
  );

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
}
