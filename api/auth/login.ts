import { tenants, users } from "../_lib/store";

export default function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = users.find(
      (u) =>
        u.email.toLowerCase() === String(email).toLowerCase() &&
        u.password === password &&
        u.isActive
    );

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const tenant = tenants.find((t) => t.id === user.tenantId && t.isActive);

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

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
      error: "Login failed",
      detail: error?.message || "Unknown error",
    });
  }
}
