export default function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body || {};
    const charityName = String(body.charityName || "").trim();
    const email = String(body.email || "").toLowerCase().trim();
    const password = String(body.password || "");

    if (!charityName || !email || !password) {
      return res.status(400).json({ error: "Charity name, email and password are required" });
    }

    const slug = charityName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "charity-demo";

    const session = encodeURIComponent(
      JSON.stringify({
        userId: "user-new-owner",
        tenantId: "tenant-new",
        email,
        role: "owner",
      })
    );

    res.setHeader(
      "Set-Cookie",
      `auth_session=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
    );

    return res.status(200).json({
      user: {
        id: "user-new-owner",
        email,
        role: "owner",
        tenantId: "tenant-new",
      },
      tenant: {
        id: "tenant-new",
        name: charityName,
        slug,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      error: "Register crashed",
      detail: error?.message || "Unknown error",
    });
  }
}
