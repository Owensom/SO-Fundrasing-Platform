import { nowIso, slugify, tenants, users } from "../_lib/store";

export default function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { charityName, email, password } = req.body || {};

    if (!charityName || !email || !password) {
      return res.status(400).json({ error: "Charity name, email and password are required" });
    }

    const existingUser = users.find(
      (u) => u.email.toLowerCase() === String(email).toLowerCase()
    );

    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const baseSlug = slugify(String(charityName));
    let finalSlug = baseSlug || "charity";
    let counter = 2;

    while (tenants.some((t) => t.slug === finalSlug)) {
      finalSlug = `${baseSlug}-${counter}`;
      counter += 1;
    }

    const tenantId = `tenant-${Date.now()}`;
    const userId = `user-${Date.now()}`;

    const tenant = {
      id: tenantId,
      name: String(charityName),
      slug: finalSlug,
      isActive: true,
    };

    const user = {
      id: userId,
      tenantId,
      email: String(email).toLowerCase(),
      password: String(password),
      role: "owner",
      isActive: true,
      createdAt: nowIso(),
    };

    tenants.push(tenant);
    users.push(user);

    const session = encodeURIComponent(
      JSON.stringify({
        userId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
      })
    );

    res.setHeader(
      "Set-Cookie",
      `auth_session=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
    );

    return res.status(200).json({
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
  } catch (error: any) {
    return res.status(500).json({
      error: "Registration failed",
      detail: error?.message || "Unknown error",
    });
  }
}
