import { tenants, users } from "../_lib/store";

function getCookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(";").map((part) => part.trim());
  const found = parts.find((part) => part.startsWith(`${name}=`));

  if (!found) return null;

  return found.substring(name.length + 1);
}

export default function handler(req: any, res: any) {
  try {
    const raw = getCookieValue(req.headers.cookie, "auth_session");

    if (!raw) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    let session: any = null;

    try {
      session = JSON.parse(decodeURIComponent(raw));
    } catch {
      return res.status(401).json({ error: "Invalid session" });
    }

    const user = users.find((u) => u.id === session.userId && u.isActive);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const tenant = tenants.find((t) => t.id === user.tenantId && t.isActive);

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

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
      error: "Failed to read session",
      detail: error?.message || "Unknown error",
    });
  }
}
