function getCookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(";").map((part) => part.trim());
  const found = parts.find((part) => part.startsWith(`${name}=`));

  if (!found) return null;

  return found.substring(name.length + 1);
}

export default function handler(req: any, res: any) {
  try {
    const raw = getCookieValue(req.headers?.cookie, "auth_session");

    if (!raw) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    let session: any = null;

    try {
      session = JSON.parse(decodeURIComponent(raw));
    } catch {
      return res.status(401).json({ error: "Invalid session" });
    }

    return res.status(200).json({
      user: {
        id: session.userId || "user-demo-a-owner",
        email: session.email || "ownera@example.com",
        role: session.role || "owner",
        tenantId: session.tenantId || "tenant-demo-a",
      },
      tenant: {
        id: "tenant-demo-a",
        name: "SO Fundraising Demo A",
        slug: "demo-a",
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      error: "Auth me crashed",
      detail: error?.message || "Unknown error",
    });
  }
}
